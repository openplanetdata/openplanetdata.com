import { handleFeedback } from './feedback';
import { handleStats } from './stats';
import type { Env } from './env';

/**
 * The site itself is static. Cloudflare serves everything in `dist/` straight
 * from the assets store and only falls through to this Worker for paths that do
 * not exist as files — which is exactly the `/api/*` surface below.
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const { pathname } = new URL(request.url);

		switch (pathname) {
			case '/api/feedback':
				return handleFeedback(request, env, ctx);
			case '/api/stats':
				return handleStats(request, env, ctx);
			default:
				return env.ASSETS.fetch(request);
		}
	},
} satisfies ExportedHandler<Env>;
