/**
 * Bindings declared in wrangler.jsonc.
 *
 * The rate limiter and email sender are typed structurally rather than pulled
 * from @cloudflare/workers-types so the Worker keeps compiling across versions
 * that move those definitions around. Both are optional: a deployment without
 * them still records feedback, it just stops throttling or notifying.
 */

export interface RateLimiter {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface EmailSender {
	send(message: unknown): Promise<void>;
}

export interface Env {
	ASSETS: Fetcher;
	FEEDBACK_DB: D1Database;
	INDEX_DB: D1Database;
	FEEDBACK_LIMITER?: RateLimiter;
	COMMENT_LIMITER?: RateLimiter;
	FEEDBACK_EMAIL?: EmailSender;
	FEEDBACK_EMAIL_TO?: string;
	FEEDBACK_EMAIL_FROM?: string;
	/** Secret. Salts the stored IP hashes; set with `wrangler secret put`. */
	FEEDBACK_IP_SALT?: string;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'no-store',
			...headers,
		},
	});
}

/** Midnight UTC of `timestamp`, in milliseconds — matches the r2index convention. */
export function dayBucketOf(timestamp: number): number {
	return Math.floor(timestamp / 86_400_000) * 86_400_000;
}

/** `YYYYMM` as an integer — also matches r2index. */
export function monthBucketOf(timestamp: number): number {
	const date = new Date(timestamp);
	return date.getUTCFullYear() * 100 + date.getUTCMonth() + 1;
}
