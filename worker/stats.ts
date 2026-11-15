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
 * The pipelines that build the datasets fetch their inputs through the r2index
 * Python client, which logs each fetch as a download. Those are our own builds,
 * not usage, so every figure is computed without them. A request with no
 * User-Agent is someone else's and stays in.
 */
const PUBLIC_DOWNLOADS = `SELECT * FROM file_downloads
	                           WHERE COALESCE(user_agent, '') NOT LIKE 'elaunira-r2index/%'`;

/**
 * A download row carries only the R2 coordinates, so size and human-readable
 * naming come from the catalog. Version is part of the key: without it a file
 * published as both v1 and v2 matches twice and inflates every byte total.
 */
const DOWNLOADS_JOIN = `
	  FROM (${PUBLIC_DOWNLOADS}) d
	  LEFT JOIN files f
	         ON f.remote_path = d.remote_path
	        AND f.remote_filename = d.remote_filename
	        AND f.remote_version IS d.remote_version`;

/**
 * A logged request is either a download of a file or a partial download: a
 * tool (a tile reader, a Parquet client) that fetched only byte ranges of it.
 * Counting a partial download as a download would let a 64-byte header probe
 * weigh as much as a 72 GB planet, so the two are counted apart.
 *
 * Data served covers downloads only. A partial download is logged once, by its
 * first request, so the bytes on its row are those of a header, not what the
 * tool went on to fetch: adding them up would publish a figure nobody measured.
 */
const DOWNLOADS = `COALESCE(SUM(d.partial = 0), 0)`;
const PARTIAL_READS = `COALESCE(SUM(d.partial = 1), 0)`;
const BYTES = `COALESCE(SUM(CASE WHEN d.partial = 1 THEN 0 ELSE f.size END), 0)`;

/**
 * IP addresses are not stored: each request carries a keyed hash of its address
 * instead, and that is what tells one client from another. The address is only
 * read for a request that has no hash yet.
 */
const CLIENT = `COALESCE(d.ip_hash, d.ip_address)`;

/** Totals over a set of logged requests. Visitors are counted over both kinds. */
const TOTALS = `${DOWNLOADS} AS downloads,
			        ${PARTIAL_READS} AS partial_reads,
			        COUNT(DISTINCT ${CLIENT}) AS visitors,
			        ${BYTES} AS bytes`;

/**
 * The tool a request came from: the label it declared with ?client=, or the
 * one the download service gave its User-Agent. Requests logged before those
 * labels existed carry none, so the same families are recognised here from
 * their User-Agent, under the same names.
 */
const TOOL = `CASE
			        WHEN d.client IS NOT NULL THEN d.client
			        WHEN COALESCE(d.user_agent, '') = '' THEN 'unidentified'
			        WHEN d.user_agent LIKE 'rclone/%' THEN 'rclone'
			        WHEN d.user_agent LIKE 'aria2/%' THEN 'aria2'
			        WHEN d.user_agent LIKE 'geodesk-gol/%' THEN 'geodesk-gol'
			        WHEN d.user_agent LIKE 'duckdb/%' THEN 'duckdb'
			        WHEN d.user_agent LIKE 'GDAL/%' THEN 'gdal'
			        WHEN d.user_agent LIKE 'curl/%' THEN 'curl'
			        WHEN d.user_agent LIKE 'Wget/%' THEN 'wget'
			        WHEN d.user_agent LIKE 'python-requests/%' THEN 'python-requests'
			        WHEN d.user_agent LIKE 'Python/%aiohttp/%' THEN 'aiohttp'
			        WHEN d.user_agent LIKE 'okhttp/%' THEN 'okhttp'
			        WHEN d.user_agent = 'node' THEN 'node'
			        WHEN d.user_agent LIKE 'Mozilla/%' THEN 'browser'
			        ELSE 'other'
			      END`;

// A tool is listed by name once this many distinct clients have used it, and at
// most this many tools are listed. A label is whatever a tool declares, so one
// that a single client sends is neither published nor able to fill the page.
const TOOL_MIN_CLIENTS = 3;
const TOOL_LIST_LIMIT = 15;

interface Totals {
	downloads: number;
	partial_reads: number;
	visitors: number;
	bytes: number;
}

interface ToolBreakdown {
	label: string;
	downloads: number;
	partial_reads: number;
	bytes: number;
}

/**
 * The tools to publish, from every tool ranked by use: those with enough
 * clients keep their name, up to the list limit, and everything else is added
 * to "other". Requests that named no tool at all stay a line of their own.
 */
function listTools(ranked: (ToolBreakdown & { visitors: number })[]): ToolBreakdown[] {
	const listed: ToolBreakdown[] = [];
	const other: ToolBreakdown = { label: 'other', downloads: 0, partial_reads: 0, bytes: 0 };

	for (const { label, downloads, partial_reads, bytes, visitors } of ranked) {
		const named = label !== 'other' && (label === 'unidentified' || visitors >= TOOL_MIN_CLIENTS);
		if (named && listed.length < TOOL_LIST_LIMIT) {
			listed.push({ label, downloads, partial_reads, bytes });
		} else {
			other.downloads += downloads;
			other.partial_reads += partial_reads;
			other.bytes += bytes;
		}
	}

	if (other.downloads + other.partial_reads > 0) listed.push(other);
	return listed;
}

interface SeriesPoint extends Totals {
	day: number;
}

const NO_TOTALS: Totals = { downloads: 0, partial_reads: 0, visitors: 0, bytes: 0 };

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

	const [allTime, period, previous, series, byCategory, byFormat, top, byTool, catalog] = await db.batch([
		db.prepare(
			`SELECT ${TOTALS}
			   ${DOWNLOADS_JOIN}`,
		),
		db.prepare(
			`SELECT ${TOTALS}
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1`,
		).bind(since),
		// The window immediately before this one, so each tile can show a delta.
		db.prepare(
			`SELECT ${TOTALS}
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1 AND d.day_bucket < ?2`,
		).bind(previousSince, since),
		db.prepare(
			`SELECT d.day_bucket AS day,
			        ${TOTALS}
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1
			  GROUP BY d.day_bucket
			  ORDER BY d.day_bucket`,
		).bind(since),
		// Grouped by the expression, not by the `label` alias: `files` has a
		// `name` column, and SQLite resolves a bare GROUP BY term to a real
		// column before an output alias — which silently groups by entity.
		// The breakdowns rank downloads, so a group that was only ever read
		// partially is left out rather than listed with a zero.
		db.prepare(
			`SELECT COALESCE(NULLIF(f.category, ''), 'unknown') AS label,
			        ${DOWNLOADS} AS downloads,
			        ${BYTES} AS bytes
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1
			  GROUP BY COALESCE(NULLIF(f.category, ''), 'unknown')
			 HAVING ${DOWNLOADS} > 0
			  ORDER BY downloads DESC`,
		).bind(since),
		db.prepare(
			`SELECT COALESCE(NULLIF(f.extension, ''), 'unknown') AS label,
			        ${DOWNLOADS} AS downloads,
			        ${BYTES} AS bytes
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1
			  GROUP BY COALESCE(NULLIF(f.extension, ''), 'unknown')
			 HAVING ${DOWNLOADS} > 0
			  ORDER BY downloads DESC`,
		).bind(since),
		db.prepare(
			`SELECT d.remote_path AS path,
			        MAX(COALESCE(f.category, '')) AS category,
			        MAX(COALESCE(f.entity, '')) AS entity,
			        MAX(COALESCE(f.extension, '')) AS extension,
			        ${DOWNLOADS} AS downloads,
			        ${BYTES} AS bytes
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1
			  GROUP BY d.remote_path
			 HAVING ${DOWNLOADS} > 0
			  ORDER BY downloads DESC
			  LIMIT 10`,
		).bind(since),
		// Downloads and partial downloads together: a tool that only ever
		// fetches parts of files is still a tool people use.
		db.prepare(
			`SELECT ${TOOL} AS label,
			        ${TOTALS}
			   ${DOWNLOADS_JOIN}
			  WHERE d.day_bucket >= ?1
			  GROUP BY ${TOOL}
			  ORDER BY COUNT(*) DESC, label`,
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
			all_time: first<Totals>(allTime, NO_TOTALS),
			period: first<Totals>(period, NO_TOTALS),
			previous: first<Totals>(previous, NO_TOTALS),
			series: fillDays(rows<SeriesPoint>(series), since),
			by_category: rows<Breakdown>(byCategory),
			by_format: rows<Breakdown>(byFormat),
			by_client: listTools(rows<ToolBreakdown & { visitors: number }>(byTool)),
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

// `batch()` returns one result per statement, but the type system cannot know
// that, and a defensive fallback beats a crash if that ever stops holding.
function rows<T>(result: D1Result | undefined): T[] {
	return (result?.results ?? []) as T[];
}

function first<T>(result: D1Result | undefined, fallback: T): T {
	return ((result?.results ?? [])[0] as T | undefined) ?? fallback;
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
		filled.push(byDay.get(day) ?? { day, ...NO_TOTALS });
	}
	return filled;
}
