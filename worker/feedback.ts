import { EmailMessage } from 'cloudflare:email';
import { dayBucketOf, json, monthBucketOf, type Env } from './env';
import { buildFeedbackEmail, type Notification } from './feedback-email';

const MAX_BODY_BYTES = 8 * 1024;
const MAX_PAGE_LENGTH = 256;
const MAX_COMMENT_LENGTH = 2000;
const MAX_EMAIL_LENGTH = 254;

/** Nobody writes a sentence of prose this fast; a script fills the field instantly. */
const MIN_COMPOSE_MS = 1500;

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_COMMENTS_PER_WINDOW = 3;

const REASONS = new Set(['inaccurate', 'outdated', 'confusing', 'incomplete', 'missing', 'broken', 'other']);

const EMAIL_PATTERN = /^[^\s@,;:<>"']+@[^\s@,;:<>"'.]+(\.[^\s@,;:<>"'.]+)+$/;

interface Payload {
	page?: unknown;
	helpful?: unknown;
	reason?: unknown;
	comment?: unknown;
	email?: unknown;
	/** Honeypot. Hidden from real users, so any value means a bot filled the form. */
	website?: unknown;
	/** Milliseconds between the widget rendering and the submission. */
	elapsed?: unknown;
}

export async function handleFeedback(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	if (request.method !== 'POST') {
		return json({ error: 'method_not_allowed' }, 405, { allow: 'POST' });
	}

	// The widget is same-origin, and browsers always attach Origin to a POST.
	// Anything else is a script talking to the API directly.
	if (request.headers.get('origin') !== new URL(request.url).origin) {
		return json({ error: 'forbidden' }, 403);
	}

	const declaredLength = Number(request.headers.get('content-length') ?? '0');
	if (declaredLength > MAX_BODY_BYTES) {
		return json({ error: 'payload_too_large' }, 413);
	}

	const raw = await request.text();
	if (raw.length > MAX_BODY_BYTES) {
		return json({ error: 'payload_too_large' }, 413);
	}

	let payload: Payload;
	try {
		payload = JSON.parse(raw) as Payload;
	} catch {
		return json({ error: 'invalid_json' }, 400);
	}

	// Honeypot: answer 200 so the bot books it as a success and moves on rather
	// than probing for the shape that gets through.
	if (typeof payload.website === 'string' && payload.website.trim() !== '') {
		return json({ ok: true, recorded: false });
	}

	const page = normalizePage(payload.page);
	if (!page) {
		return json({ error: 'invalid_page' }, 400);
	}
	if (typeof payload.helpful !== 'boolean') {
		return json({ error: 'invalid_helpful' }, 400);
	}

	const helpful = payload.helpful;
	const comment = typeof payload.comment === 'string' ? payload.comment.trim().slice(0, MAX_COMMENT_LENGTH) : '';
	const reason = typeof payload.reason === 'string' && REASONS.has(payload.reason) ? payload.reason : null;
	const contactEmail = normalizeEmail(payload.email);

	// A positive vote is a single click and never carries prose, so anything
	// attached to one came from a script.
	if (helpful && comment) {
		return json({ error: 'invalid_comment' }, 400);
	}

	if (comment) {
		const elapsed = Number(payload.elapsed);
		if (!Number.isFinite(elapsed) || elapsed < MIN_COMPOSE_MS) {
			return json({ error: 'too_fast' }, 429);
		}
	}

	const ip = request.headers.get('cf-connecting-ip') ?? '0.0.0.0';

	if (env.FEEDBACK_LIMITER && !(await env.FEEDBACK_LIMITER.limit({ key: ip })).success) {
		return json({ error: 'rate_limited' }, 429);
	}
	if (comment && env.COMMENT_LIMITER && !(await env.COMMENT_LIMITER.limit({ key: ip })).success) {
		return json({ error: 'rate_limited' }, 429);
	}

	const ipHash = await hashIp(ip, env.FEEDBACK_IP_SALT);
	const now = Date.now();
	const since = now - DEDUPE_WINDOW_MS;

	// Cloudflare's edge geolocation of the client IP. Resolved once here so the
	// comment path reports it too — the widget votes first and comments second,
	// so that is the path every real notification takes.
	const country = (request as { cf?: { country?: string } }).cf?.country ?? null;

	// One vote per visitor per page per day.
	const existing = await env.FEEDBACK_DB.prepare(
		`SELECT id, comment
		   FROM page_feedback
		  WHERE ip_hash = ?1 AND page = ?2 AND created_at >= ?3
		  ORDER BY created_at DESC
		  LIMIT 1`,
	)
		.bind(ipHash, page, since)
		.first<{ id: number; comment: string | null }>();

	if (existing) {
		// The widget records the vote on click and only then opens the comment
		// form, so the explanation has to land on the existing row. Inserting a
		// second one would count the same visitor's opinion twice.
		if (!comment) {
			return json({ ok: true, recorded: false, reason: 'already_voted' });
		}
		if (existing.comment) {
			return json({ ok: true, recorded: false, reason: 'already_commented' });
		}
		if (await commentQuotaReached(env, ipHash, since)) {
			return json({ ok: true, recorded: false, reason: 'comment_quota' });
		}

		await env.FEEDBACK_DB.prepare(
			`UPDATE page_feedback
			    SET comment = ?1, reason = COALESCE(?2, reason), contact_email = COALESCE(?3, contact_email)
			  WHERE id = ?4`,
		)
			.bind(comment, reason, contactEmail, existing.id)
			.run();

		// Any written comment is worth telling someone about. Volume is already
		// bounded by the per-visitor comment quota, so there is no length floor:
		// "404" and "typo" are real reports, and silently dropping them looks
		// identical to the mail failing.
		if (!helpful && comment) {
			ctx.waitUntil(notify(env, { page, reason, comment, contactEmail, country }));
		}
		return json({ ok: true, recorded: true });
	}

	if (comment && (await commentQuotaReached(env, ipHash, since))) {
		return json({ ok: true, recorded: false, reason: 'comment_quota' });
	}

	// ON CONFLICT closes the gap between the SELECT above and this INSERT: two
	// concurrent submissions both read "no existing vote", and the unique index
	// on (ip_hash, page, day_bucket) lets exactly one of them land.
	const inserted = await env.FEEDBACK_DB.prepare(
		`INSERT INTO page_feedback
		   (page, helpful, reason, comment, contact_email, country, ip_hash, created_at, day_bucket, month_bucket)
		 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
		 ON CONFLICT (ip_hash, page, day_bucket) DO NOTHING`,
	)
		.bind(
			page,
			helpful ? 1 : 0,
			reason,
			comment || null,
			contactEmail,
			country,
			ipHash,
			now,
			dayBucketOf(now),
			monthBucketOf(now),
		)
		.run();

	if (inserted.meta.changes === 0) {
		return json({ ok: true, recorded: false, reason: 'already_voted' });
	}

	// Only written complaints are worth an inbox interruption. A bare "No" click
	// is a number on the stats page, nothing more.
	if (!helpful && comment) {
		ctx.waitUntil(notify(env, { page, reason, comment, contactEmail, country }));
	}

	return json({ ok: true, recorded: true });
}

async function commentQuotaReached(env: Env, ipHash: string, since: number): Promise<boolean> {
	const written = await env.FEEDBACK_DB.prepare(
		`SELECT COUNT(*) AS comments
		   FROM page_feedback
		  WHERE ip_hash = ?1 AND comment IS NOT NULL AND created_at >= ?2`,
	)
		.bind(ipHash, since)
		.first<{ comments: number }>();

	return (written?.comments ?? 0) >= MAX_COMMENTS_PER_WINDOW;
}

/**
 * Accepts only site-relative paths, normalised to the trailing-slash form
 * Starlight actually serves, so `/datasets/countries` and
 * `/datasets/countries/?x=1#top` aggregate into one row.
 */
function normalizePage(value: unknown): string | null {
	if (typeof value !== 'string') return null;

	let path = value.trim();
	if (!path.startsWith('/') || path.startsWith('//')) return null;
	if (path.length > MAX_PAGE_LENGTH) return null;

	path = path.split(/[?#]/)[0]!;
	if (!/^\/[\w\-./]*$/.test(path)) return null;
	if (path.includes('..')) return null;
	if (path.length > 1 && !path.endsWith('/')) path += '/';

	return path;
}

function normalizeEmail(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const email = value.trim();
	if (!email || email.length > MAX_EMAIL_LENGTH) return null;
	return EMAIL_PATTERN.test(email) ? email : null;
}

/**
 * Stored instead of the address itself: enough to dedupe votes and cap abuse,
 * not enough to work back to a visitor.
 */
async function hashIp(ip: string, salt = 'openplanetdata'): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('')
		.slice(0, 32);
}

async function notify(env: Env, feedback: Notification): Promise<void> {
	const { FEEDBACK_EMAIL: sender, FEEDBACK_EMAIL_TO: to, FEEDBACK_EMAIL_FROM: from } = env;
	if (!sender || !to || !from) return;

	try {
		await sender.send(new EmailMessage(from, to, buildFeedbackEmail({ from, to, feedback })));
	} catch (error) {
		// Never fail the visitor's submission over a delivery problem — the row
		// is already in D1 and readable from the stats tooling.
		console.error('feedback email failed', error);
	}
}
