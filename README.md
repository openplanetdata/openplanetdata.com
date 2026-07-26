# OpenPlanetData Website

The website for [OpenPlanetData](https://openplanetdata.com), built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## Commands

All commands are run from the root of the project:

| Command             | Action                                                      |
| :------------------ | :---------------------------------------------------------- |
| `npm install`       | Install dependencies                                         |
| `npm run dev`       | Start local dev server at `localhost:4321` (no API routes)   |
| `npm run build`     | Build production site to `./dist/`                           |
| `npm run preview`   | Preview production build locally                             |
| `npm run dev:api`   | Build, then serve site **and** API on `localhost:8787`       |

Astro's dev server only serves the static site. Anything touching `/api/*` — the
feedback widget and the statistics page — needs `npm run dev:api`, which runs the
Worker in front of the built assets.

## Architecture

The site is static Astro/Starlight served from Cloudflare's asset store. A small
Worker (`worker/`) sits behind it and only handles the paths that are not files:

| Route           | Purpose                                                                 |
| :-------------- | :---------------------------------------------------------------------- |
| `/api/feedback` | Records "Was this page helpful?" votes and comments                      |
| `/api/stats`    | Download and feedback aggregates behind `/statistics/` (edge-cached 5 min)    |

Two D1 databases are bound:

- **`FEEDBACK_DB`** (`openplanetdata-website`) — page feedback, owned by this repo.
  Schema lives in `migrations/`.
- **`INDEX_DB`** (`r2index`) — the pipeline's file catalog and download log. Read
  only; this repo never writes to it. It is bound as `remote` so `npm run dev:api`
  charts real data.

### Anti-spam

Feedback submissions are gated by same-origin checks, a hidden honeypot field, a
minimum compose time, two Cloudflare rate limiters, one vote per visitor per page
per day, and a cap of three comments per visitor per day. Only negative feedback
carrying a written comment triggers an email; a bare "No" click is just a number.

## Deployment

```
npm run build
npx wrangler deploy
```

### One-time setup

1. Apply the feedback schema:

   ```
   npx wrangler d1 migrations apply openplanetdata-website --remote
   ```

2. Salt the stored IP hashes (used for deduplication, never stored raw):

   ```
   npx wrangler secret put FEEDBACK_IP_SALT
   ```

3. To receive negative feedback by email, the recipient must be a **verified
   destination address** under Email Routing → Destination addresses in the
   Cloudflare dashboard. That is the only requirement the `send_email` binding
   enforces — the sender domain does *not* need Email Routing enabled, and
   enabling it on `openplanetdata.com` would replace the Google Workspace MX
   records and break inbound mail, so don't.

   The recipient is kept out of this public repo as a secret:

   ```
   npx wrangler secret put FEEDBACK_EMAIL_TO
   ```

   If it is unset or not verified, sending is skipped and the feedback is still
   stored in D1 — nothing is lost.

   Note that `openplanetdata.com` publishes `v=spf1 include:_spf.google.com`,
   which does not cover Cloudflare's sending path, so notifications can land in
   spam. DMARC is `p=none`, so they are not rejected. If they do get filtered,
   either add an inbox rule or move `FEEDBACK_EMAIL_FROM` to a domain in this
   account whose Email Routing is already `ready`.

### Reading feedback comments

Comments are never exposed by `/api/stats`. Read them directly:

```
npx wrangler d1 execute openplanetdata-website --remote \
  --command "SELECT created_at, page, reason, comment, contact_email
               FROM page_feedback WHERE comment IS NOT NULL
              ORDER BY created_at DESC LIMIT 50"
```
