# OpenPlanetData Website

The website for [OpenPlanetData](https://openplanetdata.com), built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

## Commands

All commands are run from the root of the project:

| Command           | Action                                       |
| :---------------- | :------------------------------------------- |
| `npm install`     | Install dependencies                         |
| `npm run dev`     | Start local dev server at `localhost:4321`   |
| `npm run build`   | Build production site to `./dist/`           |
| `npm run preview` | Preview production build locally             |

## Deployment

The site is deployed as static assets to Cloudflare Pages using [Wrangler](https://developers.cloudflare.com/workers/wrangler/):

```
npm run build
npx wrangler deploy
```
