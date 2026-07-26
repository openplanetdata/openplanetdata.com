import { dayBucketOf, json, type Env } from './env';

const PERIODS: Record<string, number> = {
	'7d': 7,
	'30d': 30,
	'90d': 90,
	'365d': 365,
};

const DEFAULT_PERIOD = '90d';
const EDGE_TTL_SECONDS = 300;
const BROWSER_TTL_SECONDS = 60;

/**
 * A download row carries only the R2 coordinates, so size and human-readable
 * naming come from the catalog. Version is part of the key: without it a file
 * published as both v1 and v2 matches twice and inflates every byte total.
 */
const DOWNLOADS_JOIN = `
	  FROM file_downloads d
	  LEFT JOIN files f
	         ON f.remote_path = d.remote_path
	        AND f.remote_filename = d.remote_filename
	        AND f.remote_version IS d.remote_version`;

interface Totals {
	downloads: number;
	visitors: number;
	bytes: number;
}

interface SeriesPoint {
	day: number;
	downloads: number;
	visitors: number;
	bytes: number;
}

interface Breakdown {
	label: string;
	downloads: number;
	bytes: number;
}

export async function handleStats(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		return json({ error: 'method_not_allowed' }, 405, { allow: 'GET' });
	}

	const url = new URL(request.url);
	const periodKey = url.searchParams.get('period') ?? DEFAULT_PERIOD;
	const days = PERIODS[periodKey];
	if (!days) {
		return json({ error: 'invalid_period', allowed: Object.keys(PERIODS) }, 400);
	}

	// Normalised key so `/api/stats` and `/api/stats?period=90d` share an entry.
	const cacheKey = new Request(`${url.origin}/api/stats?period=${periodKey}`);
	const cache = caches.default;
	const cached = await cache.match(cacheKey);
	if (cached) return cached;

	const now = Date.now();
	const since = dayBucketOf(now) - (days - 1) * 86_400_000;

	const [downloads, feedback] = await Promise.all([
		loadDownloads(env, since, days),
		loadFeedback(env, since),
	]);

	// A section that could not be read is reported as null rather than as zeros:
	// the page then says "unavailable" instead of quietly claiming nobody
	// downloaded anything.
	const unavailable = [
		downloads === null ? 'downloads' : null,
		feedback === null ? 'feedback' : null,
	].filter((name): name is string => name !== null);

	const payload = {
		generated_at: now,
		period: { key: periodKey, days, since },
		unavailable,
		catalog: downloads?.catalog ?? null,
		downloads: downloads?.downloads ?? null,
		feedback,
	};

	const response = json(payload, 200, {
		'cache-control': `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}`,
	});
	ctx.waitUntil(cache.put(cacheKey, response.clone()));
	return response;
}

async function loadDownloads(env: Env, since: number, days: number) {
	try {
		return await queryDownloads(env, since, days);
	} catch (error) {
		console.error('download stats unavailable', error);
		return null;
	}
}

async function queryDownloads(env: Env, since: number, days: number) {
	const db = env.INDEX_DB;
	const previousSince = since - days * 86_400_000;

	const [allTime, period, previous, series, byCategory, byFormat, top, catalog] = await db.batch([
		db.prepare(
			`SELECT COUNT(*) AS downloads,
			        COUNT(DISTINCT d.ip_address) AS visitors,
			        COALESCE(SUM(f.size), 0) AS bytes
			   ${DOWNLOADS_JOIN}`,
		),
		db.prepare(
			`SELECT COUNT(*) AS downloads,
			        COUNT(DISTINCT d.ip_address) AS visitors,
			        COALESCE(SUM(f.size), 0) AS bytes
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1`,
		).bind(since),
		// The window immediately before this one, so each tile can show a delta.
		db.prepare(
			`SELECT COUNT(*) AS downloads,
			        COUNT(DISTINCT d.ip_address) AS visitors,
			        COALESCE(SUM(f.size), 0) AS bytes
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1 AND d.day_bucket < ?2`,
		).bind(previousSince, since),
		db.prepare(
			`SELECT d.day_bucket AS day,
			        COUNT(*) AS downloads,
			        COUNT(DISTINCT d.ip_address) AS visitors,
			        COALESCE(SUM(f.size), 0) AS bytes
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1
			  GROUP BY d.day_bucket
			  ORDER BY d.day_bucket`,
		).bind(since),
		// Grouped by the expression, not by the `label` alias: `files` has a
		// `name` column, and SQLite resolves a bare GROUP BY term to a real
		// column before an output alias — which silently groups by entity.
		db.prepare(
			`SELECT COALESCE(NULLIF(f.category, ''), 'unknown') AS label,
			        COUNT(*) AS downloads,
			        COALESCE(SUM(f.size), 0) AS bytes
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1
			  GROUP BY COALESCE(NULLIF(f.category, ''), 'unknown')
			  ORDER BY downloads DESC`,
		).bind(since),
		db.prepare(
			`SELECT COALESCE(NULLIF(f.extension, ''), 'unknown') AS label,
			        COUNT(*) AS downloads,
			        COALESCE(SUM(f.size), 0) AS bytes
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1
			  GROUP BY COALESCE(NULLIF(f.extension, ''), 'unknown')
			  ORDER BY downloads DESC`,
		).bind(since),
		db.prepare(
			`SELECT d.remote_path AS path,
			        MAX(COALESCE(f.category, '')) AS category,
			        MAX(COALESCE(f.entity, '')) AS entity,
			        MAX(COALESCE(f.extension, '')) AS extension,
			        COUNT(*) AS downloads,
			        COALESCE(SUM(f.size), 0) AS bytes
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1
			  GROUP BY d.remote_path
			  ORDER BY downloads DESC
			  LIMIT 10`,
		).bind(since),
		db.prepare(
			`SELECT COUNT(*) AS files,
			        COALESCE(SUM(size), 0) AS bytes,
			        COUNT(DISTINCT category) AS categories,
			        COALESCE(MAX(updated), 0) AS updated
			   FROM files
			  WHERE deprecated = 0`,
		),
	]);

	return {
		catalog: first(catalog, { files: 0, bytes: 0, categories: 0, updated: 0 }),
		downloads: {
			all_time: first<Totals>(allTime, { downloads: 0, visitors: 0, bytes: 0 }),
			period: first<Totals>(period, { downloads: 0, visitors: 0, bytes: 0 }),
			previous: first<Totals>(previous, { downloads: 0, visitors: 0, bytes: 0 }),
			series: fillDays(rows<SeriesPoint>(series), since),
			by_category: rows<Breakdown>(byCategory),
			by_format: rows<Breakdown>(byFormat),
			top: rows(top),
		},
	};
}

async function loadFeedback(env: Env, since: number) {
	try {
		const db = env.FEEDBACK_DB;
		const [allTime, period, series, byPage, byCountry] = await db.batch([
			db.prepare(
				`SELECT COUNT(*) AS responses, COALESCE(SUM(helpful), 0) AS helpful FROM page_feedback`,
			),
			db.prepare(
				`SELECT COUNT(*) AS responses, COALESCE(SUM(helpful), 0) AS helpful
				   FROM page_feedback WHERE day_bucket >= ?1`,
			).bind(since),
			db.prepare(
				`SELECT day_bucket AS day, COUNT(*) AS responses, COALESCE(SUM(helpful), 0) AS helpful
				   FROM page_feedback
				  WHERE day_bucket >= ?1
				  GROUP BY day_bucket
				  ORDER BY day_bucket`,
			).bind(since),
			// Deliberately no `comment` column: this endpoint is public.
			db.prepare(
				`SELECT page, COUNT(*) AS responses, COALESCE(SUM(helpful), 0) AS helpful
				   FROM page_feedback
				  WHERE day_bucket >= ?1
				  GROUP BY page
				  ORDER BY responses DESC, page
				  LIMIT 25`,
			).bind(since),
			// Grouped by the expression rather than the `code` alias, for the same
			// reason as the download breakdowns: a bare GROUP BY term resolves to a
			// real column first.
			db.prepare(
				`SELECT COALESCE(NULLIF(country, ''), 'XX') AS code,
				        COUNT(*) AS responses,
				        COALESCE(SUM(helpful), 0) AS helpful
				   FROM page_feedback
				  WHERE day_bucket >= ?1
				  GROUP BY COALESCE(NULLIF(country, ''), 'XX')
				  ORDER BY responses DESC
				  LIMIT 12`,
			).bind(since),
		]);

		return {
			all_time: first(allTime, { responses: 0, helpful: 0 }),
			period: first(period, { responses: 0, helpful: 0 }),
			series: rows<{ day: number; responses: number; helpful: number }>(series),
			by_page: rows<{ page: string; responses: number; helpful: number }>(byPage),
			by_country: rows<{ code: string; responses: number; helpful: number }>(byCountry),
		};
	} catch (error) {
		// Downloads are the bulk of the page; a feedback table that has not been
		// migrated yet should not blank the whole dashboard.
		console.error('feedback stats unavailable', error);
		return null;
	}
}

function rows<T>(result: D1Result): T[] {
	return (result.results ?? []) as T[];
}

function first<T>(result: D1Result, fallback: T): T {
	return ((result.results ?? [])[0] as T | undefined) ?? fallback;
}

/**
 * Days with no downloads are absent from a GROUP BY. Charting the gaps as
 * nothing rather than as zero would draw a line straight across a quiet week.
 */
function fillDays(series: SeriesPoint[], since: number): SeriesPoint[] {
	const byDay = new Map(series.map((point) => [point.day, point]));
	const today = dayBucketOf(Date.now());
	const filled: SeriesPoint[] = [];

	for (let day = since; day <= today; day += 86_400_000) {
		filled.push(byDay.get(day) ?? { day, downloads: 0, visitors: 0, bytes: 0 });
	}
	return filled;
}
