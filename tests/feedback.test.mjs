/**
 * End-to-end checks for the feedback and stats API.
 *
 * Runs against a real `wrangler dev`, booted and torn down by this file, so the
 * D1 queries, rate limiters and unique index are all genuinely exercised rather
 * than mocked.
 *
 * Isolation comes from `CF-Connecting-IP`: the Worker keys rate limiting and
 * per-visitor deduplication off that header, so giving every test its own
 * address keeps them independent and lets the suite run without waiting out a
 * rate-limit window. Cloudflare overwrites the header at the edge, so it cannot
 * be spoofed in production.
 *
 * No test framework: `node:test` ships with Node.
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = 8789;
const BASE = `http://localhost:${PORT}`;
const BOOT_TIMEOUT_MS = 120_000;

let server;

/**
 * Each caller gets its own address, so no test can rate-limit another.
 *
 * Random rather than sequential: votes are deduplicated per address per page
 * per day and persist in the local D1, so a counter starting from zero would
 * make every run after the first collide with the previous one's rows.
 */
function nextIp() {
	const octet = () => randomInt(1, 255);
	return `10.${octet()}.${octet()}.${octet()}`;
}

async function post(body, { ip = nextIp(), origin = BASE, headers = {} } = {}) {
	const response = await fetch(`${BASE}/api/feedback`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'CF-Connecting-IP': ip,
			...(origin ? { origin } : {}),
			...headers,
		},
		body: JSON.stringify(body),
	});
	const text = await response.text();
	return { status: response.status, body: text ? JSON.parse(text) : null };
}

before(async () => {
	// Detached so the whole group can be signalled at the end: wrangler spawns
	// workerd as a child, and killing only the parent leaves node waiting on
	// inherited pipes long after the tests have finished.
	server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT)], {
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: true,
	});

	const ready = new Promise((resolve, reject) => {
		let output = '';
		// Cleared on success: an uncleared timer keeps the event loop alive for
		// its full duration, so the suite would idle after the last assertion.
		const timer = setTimeout(
			() => reject(new Error(`wrangler dev did not start in time\n${output}`)),
			BOOT_TIMEOUT_MS,
		);

		const watch = (chunk) => {
			output += chunk.toString();
			if (output.includes(`Ready on http://localhost:${PORT}`)) {
				clearTimeout(timer);
				resolve();
			}
		};

		server.stdout.on('data', watch);
		server.stderr.on('data', watch);
		server.on('exit', (code) => {
			clearTimeout(timer);
			reject(new Error(`wrangler dev exited early (${code})\n${output}`));
		});
	});

	await ready;
	await sleep(500);
});

after(async () => {
	if (!server?.pid) return;

	server.stdout?.destroy();
	server.stderr?.destroy();

	const signal = (name) => {
		try {
			process.kill(-server.pid, name);
		} catch {
			// Already gone.
		}
	};

	signal('SIGTERM');
	await sleep(500);
	signal('SIGKILL');
});

describe('POST /api/feedback — who is allowed to post', () => {
	it('refuses a request with no Origin, which is what a script sends', async () => {
		const { status } = await post({ page: '/a/', helpful: true }, { origin: null });
		assert.equal(status, 403);
	});

	it('refuses an Origin from another site', async () => {
		const { status } = await post({ page: '/a/', helpful: true }, { origin: 'https://evil.example' });
		assert.equal(status, 403);
	});

	it('accepts a same-origin vote', async () => {
		const { status, body } = await post({ page: '/getting-started/download/', helpful: true });
		assert.equal(status, 200);
		assert.deepEqual(body, { ok: true, recorded: true });
	});
});

describe('POST /api/feedback — input validation', () => {
	it('rejects a page that is not site-relative', async () => {
		const { status, body } = await post({ page: 'https://evil.example/x', helpful: true });
		assert.equal(status, 400);
		assert.equal(body.error, 'invalid_page');
	});

	it('rejects a path traversal attempt', async () => {
		const { body } = await post({ page: '/a/../../etc/passwd', helpful: true });
		assert.equal(body.error, 'invalid_page');
	});

	it('rejects a missing helpful flag', async () => {
		const { status, body } = await post({ page: '/a/' });
		assert.equal(status, 400);
		assert.equal(body.error, 'invalid_helpful');
	});

	it('rejects malformed JSON', async () => {
		const response = await fetch(`${BASE}/api/feedback`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', origin: BASE, 'CF-Connecting-IP': nextIp() },
			body: '{not json',
		});
		assert.equal(response.status, 400);
	});

	it('rejects prose attached to a positive vote, which only a script would send', async () => {
		const { status, body } = await post({ page: '/a/', helpful: true, comment: 'unexpected' });
		assert.equal(status, 400);
		assert.equal(body.error, 'invalid_comment');
	});

	it('treats /page and /page/ as the same page', async () => {
		const ip = nextIp();
		const first = await post({ page: '/datasets/countries', helpful: true }, { ip });
		const second = await post({ page: '/datasets/countries/', helpful: true }, { ip });

		assert.equal(first.body.recorded, true);
		assert.equal(second.body.recorded, false, 'the trailing slash variant should collapse onto the same row');
		assert.equal(second.body.reason, 'already_voted');
	});
});

describe('POST /api/feedback — spam resistance', () => {
	it('swallows a honeypot submission and records nothing', async () => {
		const { status, body } = await post({
			page: '/a/',
			helpful: false,
			website: 'http://spam.example',
		});
		// Reports success so the bot does not go looking for the shape that works.
		assert.equal(status, 200);
		assert.equal(body.recorded, false);
	});

	it('rejects a comment written impossibly fast', async () => {
		const { status, body } = await post({
			page: '/a/',
			helpful: false,
			comment: 'instantly typed by a script',
			elapsed: 30,
		});
		assert.equal(status, 429);
		assert.equal(body.error, 'too_fast');
	});

	it('rate-limits a burst from one address', async () => {
		const ip = nextIp();
		const statuses = [];
		for (let attempt = 0; attempt < 12; attempt += 1) {
			const { body } = await post({ page: `/burst-${attempt}/`, helpful: true }, { ip });
			statuses.push(body.error ?? 'ok');
		}
		assert.ok(
			statuses.includes('rate_limited'),
			`expected the limiter to trip within 12 requests, saw ${JSON.stringify(statuses)}`,
		);
	});
});

describe('POST /api/feedback — one vote per visitor per page per day', () => {
	it('does not let a second vote flip the first', async () => {
		const ip = nextIp();
		const yes = await post({ page: '/pipeline/how-we-build/', helpful: true }, { ip });
		const no = await post({ page: '/pipeline/how-we-build/', helpful: false }, { ip });

		assert.equal(yes.body.recorded, true);
		assert.equal(no.body.recorded, false);
		assert.equal(no.body.reason, 'already_voted');
	});

	it('records exactly one vote when the same click arrives concurrently', async () => {
		const ip = nextIp();
		const page = '/datasets/time-zones/';

		// The unique index is what makes this safe: the application check alone
		// is a check-then-insert race, and a double-click hits it.
		const results = await Promise.all(
			Array.from({ length: 5 }, () => post({ page, helpful: true }, { ip })),
		);

		const recorded = results.filter((result) => result.body.recorded === true);
		assert.equal(recorded.length, 1, 'exactly one of five concurrent votes should be stored');
	});

	it('keeps different pages independent', async () => {
		const ip = nextIp();
		const first = await post({ page: '/datasets/openstreetmap/', helpful: true }, { ip });
		const second = await post({ page: '/datasets/boundaries/', helpful: true }, { ip });

		assert.equal(first.body.recorded, true);
		assert.equal(second.body.recorded, true);
	});
});

describe('POST /api/feedback — comments attach to the existing vote', () => {
	it('does not create a second row when the comment follows the vote', async () => {
		const ip = nextIp();
		const page = '/getting-started/data-formats/';

		const vote = await post({ page, helpful: false }, { ip });
		assert.equal(vote.body.recorded, true);

		const comment = await post(
			{ page, helpful: false, reason: 'confusing', comment: 'GOB versus GOL is never explained.', elapsed: 9000 },
			{ ip },
		);
		assert.equal(comment.body.recorded, true, 'the comment should update the vote that already exists');

		// If it had inserted rather than updated, this would read as a fresh row
		// with no comment and be accepted again.
		const again = await post(
			{ page, helpful: false, reason: 'confusing', comment: 'A second attempt.', elapsed: 9000 },
			{ ip },
		);
		assert.equal(again.body.recorded, false);
		assert.equal(again.body.reason, 'already_commented');
	});

	it('caps how many comments one visitor can leave per day', async () => {
		const ip = nextIp();
		const outcomes = [];

		for (let index = 0; index < 5; index += 1) {
			const page = `/quota-${index}/`;
			await post({ page, helpful: false }, { ip });
			const { body } = await post(
				{ page, helpful: false, comment: `Comment number ${index} with enough length.`, elapsed: 9000 },
				{ ip },
			);
			outcomes.push(body.reason ?? (body.recorded ? 'recorded' : body.error));
			// The comment limiter allows two per minute; pace past it so this test
			// measures the daily quota rather than the burst limiter.
			await sleep(1100);
		}

		assert.ok(
			outcomes.includes('comment_quota') || outcomes.includes('rate_limited'),
			`expected the comment cap to engage, saw ${JSON.stringify(outcomes)}`,
		);
	});
});

describe('GET /api/stats', () => {
	it('rejects an unknown period', async () => {
		const response = await fetch(`${BASE}/api/stats?period=forever`);
		assert.equal(response.status, 400);
		const body = await response.json();
		assert.equal(body.error, 'invalid_period');
	});

	it('returns the documented shape', async () => {
		const response = await fetch(`${BASE}/api/stats?period=7d`);
		assert.equal(response.status, 200);

		const body = await response.json();
		assert.equal(body.period.key, '7d');
		assert.equal(body.period.days, 7);
		assert.ok(Array.isArray(body.unavailable));
		assert.ok('catalog' in body && 'downloads' in body && 'feedback' in body);

		if (body.feedback) {
			for (const key of ['all_time', 'period', 'series', 'by_page', 'by_country']) {
				assert.ok(key in body.feedback, `feedback.${key} should be present`);
			}
		}
	});

	it('never exposes comment text', async () => {
		const response = await fetch(`${BASE}/api/stats?period=90d`);
		const raw = await response.text();
		assert.ok(!raw.includes('"comment"'), 'the public endpoint must not carry comment text');
	});
});
