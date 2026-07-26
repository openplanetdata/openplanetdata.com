/**
 * Generates public/og-image.png, the preview card shown when a page is shared.
 *
 * Run with `npm run og` after changing the wording or palette. The PNG is
 * committed so the site build never depends on this script.
 */

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og-image.png');

const WIDTH = 1200;
const HEIGHT = 630;

// Brand tokens, matching src/styles/custom.css.
const SAND_LIGHT = '#ede5da';
const SAND_DARK = '#dfe1da';
const FOREST = '#2d6a4f';
const FOREST_DEEP = '#1b4332';
const INK = '#332e28';
const MUTED = '#6b6157';

// A generic stack: the brand faces are webfonts and are not installed on the
// machine that rasterises this, so the renderer falls back to whatever sans is
// available rather than silently dropping the text.
const SANS = "'Noto Sans', 'DejaVu Sans', 'Liberation Sans', sans-serif";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${SAND_LIGHT}"/>
      <stop offset="100%" stop-color="${SAND_DARK}"/>
    </linearGradient>
    <linearGradient id="globe" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${FOREST}"/>
      <stop offset="100%" stop-color="${FOREST_DEEP}"/>
    </linearGradient>
    <clipPath id="sphere"><circle cx="0" cy="0" r="138"/></clipPath>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Globe motif, bled off the right edge -->
  <g transform="translate(1048, 318)" opacity="0.92">
    <circle cx="0" cy="0" r="138" fill="url(#globe)"/>
    <g clip-path="url(#sphere)" fill="none" stroke="#ffffff" stroke-opacity="0.34" stroke-width="2">
      <ellipse cx="0" cy="0" rx="138" ry="48"/>
      <ellipse cx="0" cy="0" rx="138" ry="96"/>
      <ellipse cx="0" cy="0" rx="48" ry="138"/>
      <ellipse cx="0" cy="0" rx="96" ry="138"/>
      <line x1="-138" y1="0" x2="138" y2="0"/>
    </g>
    <circle cx="0" cy="0" r="138" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="3"/>
  </g>

  <g font-family="${SANS}">
    <text x="90" y="150" font-size="26" font-weight="700" letter-spacing="4" fill="${FOREST}">OPENPLANETDATA</text>

    <text x="90" y="262" font-size="66" font-weight="700" fill="${INK}">Open datasets about</text>
    <text x="90" y="340" font-size="66" font-weight="700" fill="${INK}">planet Earth</text>

    <text x="90" y="410" font-size="28" fill="${MUTED}">Boundaries · OpenStreetMap · Time zones · Postcodes</text>

    <g font-size="24" font-weight="600">
      <rect x="88" y="474" width="196" height="52" rx="26" fill="${FOREST}"/>
      <text x="186" y="507" fill="#ffffff" text-anchor="middle">GeoParquet</text>

      <rect x="300" y="474" width="176" height="52" rx="26" fill="${FOREST}"/>
      <text x="388" y="507" fill="#ffffff" text-anchor="middle">GeoJSON</text>

      <rect x="492" y="474" width="200" height="52" rx="26" fill="${FOREST}"/>
      <text x="592" y="507" fill="#ffffff" text-anchor="middle">GeoPackage</text>
    </g>

    <text x="90" y="580" font-size="24" fill="${MUTED}">Free · No API keys · No rate limits</text>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(OUTPUT);

const { size } = await sharp(OUTPUT).metadata().then(async (meta) => ({
	size: (await sharp(OUTPUT).toBuffer()).length,
	meta,
}));

console.log(`wrote ${OUTPUT} (${WIDTH}x${HEIGHT}, ${Math.round(size / 1024)} KB)`);
