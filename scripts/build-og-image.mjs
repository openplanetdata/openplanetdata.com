/**
 * Generates public/og-image.png, the preview card shown when a page is shared.
 *
 * Run with `npm run og` after changing the wording or palette. The PNG is
 * committed so the site build never depends on this script.
 *
 * The headline is set in DM Serif Display, the same face the site uses for
 * headings. It is not installed system-wide, so a fontconfig file scoped to
 * this process points at `assets/fonts/` and then chains to the system config
 * for everything else — nothing is installed onto the machine.
 */

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONT_DIR = join(ROOT, 'assets', 'fonts');
const OUTPUT = join(ROOT, 'public', 'og-image.png');

// Must be in place before sharp initialises its text rendering, hence the
// dynamic import further down.
const configDir = mkdtempSync(join(tmpdir(), 'opd-fonts-'));
writeFileSync(
	join(configDir, 'fonts.conf'),
	`<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONT_DIR}</dir>
  <cachedir>${configDir}/cache</cachedir>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
</fontconfig>`,
);
process.env.FONTCONFIG_FILE = join(configDir, 'fonts.conf');

const { default: sharp } = await import('sharp');

const WIDTH = 1200;
const HEIGHT = 630;

// Brand tokens, matching src/styles/custom.css.
const SAND_TOP = '#f2ece3';
const SAND_BOTTOM = '#e2ddd2';
const FOREST = '#2d6a4f';
const FOREST_DEEP = '#12352a';
const INK = '#2b2620';
const MUTED = '#7c7266';

const DISPLAY = "'DM Serif Display'";
const SANS = "'Montserrat', 'Noto Sans', sans-serif";

const MARGIN_X = 84;

/**
 * Stacks the text block and returns baselines, so the whole composition is
 * genuinely centred on the canvas rather than centred by eye.
 */
function layout(rows, offset = 0) {
	const height = rows.reduce((total, row) => total + row.height + (row.gap ?? 0), 0);
	let cursor = (HEIGHT - height) / 2 + offset;

	const placed = {};
	for (const row of rows) {
		placed[row.id] = { top: cursor, baseline: cursor + row.height };
		cursor += row.height + (row.gap ?? 0);
	}
	return placed;
}

const ROWS = [
	{ id: 'eyebrow', height: 18, gap: 30 },
	{ id: 'line1', height: 66, gap: 22 },
	{ id: 'line2', height: 66, gap: 30 },
	{ id: 'subtitle', height: 24, gap: 34 },
	{ id: 'chips', height: 52, gap: 28 },
	{ id: 'footnote', height: 18, gap: 0 },
];

const CHIP_FONT = 23;
const CHIPS = ['GeoParquet', 'GeoJSON', 'GeoPackage', 'PBF'];

function chipRow(top) {
	let x = MARGIN_X;
	const parts = [];

	for (const label of CHIPS) {
		// Montserrat SemiBold sits near 0.63em average advance.
		const width = Math.round(label.length * CHIP_FONT * 0.63) + 44;
		parts.push(`
      <rect x="${x}" y="${top}" width="${width}" height="52" rx="26" fill="${FOREST}"/>
      <text x="${x + width / 2}" y="${top + 34}" font-family="${SANS}" font-size="${CHIP_FONT}"
            font-weight="600" fill="#ffffff" text-anchor="middle" letter-spacing="0.2">${label}</text>`);
		x += width + 14;
	}
	return parts.join('');
}

// Bled off the right edge: it reads as a deliberate crop and leaves the text
// column room to breathe.
const GLOBE_X = 1062;
const GLOBE_Y = HEIGHT / 2;
const GLOBE_R = 224;

function buildSvg(offset) {
	const rows = layout(ROWS, offset);
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="${SAND_TOP}"/>
      <stop offset="100%" stop-color="${SAND_BOTTOM}"/>
    </linearGradient>

    <radialGradient id="sphere" cx="0.33" cy="0.28" r="0.95">
      <stop offset="0%" stop-color="#4f9a76"/>
      <stop offset="55%" stop-color="${FOREST}"/>
      <stop offset="100%" stop-color="${FOREST_DEEP}"/>
    </radialGradient>

    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="60%" stop-color="${FOREST}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${FOREST}" stop-opacity="0"/>
    </radialGradient>

    <clipPath id="globeClip"><circle cx="0" cy="0" r="${GLOBE_R}"/></clipPath>

    <!-- Faint graph-paper texture, a nod to the subject matter -->
    <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse">
      <path d="M34 0H0V34" fill="none" stroke="${FOREST}" stroke-opacity="0.05" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>

  <!-- Globe: soft halo, shaded sphere, graticule, terminator -->
  <g transform="translate(${GLOBE_X}, ${GLOBE_Y})">
    <circle cx="0" cy="0" r="${GLOBE_R * 1.42}" fill="url(#halo)"/>
    <circle cx="6" cy="12" r="${GLOBE_R}" fill="${FOREST_DEEP}" opacity="0.18"/>
    <circle cx="0" cy="0" r="${GLOBE_R}" fill="url(#sphere)"/>

    <g clip-path="url(#globeClip)" fill="none" stroke="#ffffff" stroke-opacity="0.26" stroke-width="1.6">
      <ellipse cx="0" cy="0" rx="${GLOBE_R}" ry="${GLOBE_R * 0.3}"/>
      <ellipse cx="0" cy="0" rx="${GLOBE_R}" ry="${GLOBE_R * 0.62}"/>
      <ellipse cx="0" cy="0" rx="${GLOBE_R}" ry="${GLOBE_R * 0.88}"/>
      <ellipse cx="0" cy="0" rx="${GLOBE_R * 0.3}" ry="${GLOBE_R}"/>
      <ellipse cx="0" cy="0" rx="${GLOBE_R * 0.62}" ry="${GLOBE_R}"/>
      <ellipse cx="0" cy="0" rx="${GLOBE_R * 0.88}" ry="${GLOBE_R}"/>
      <line x1="-${GLOBE_R}" y1="0" x2="${GLOBE_R}" y2="0" stroke-opacity="0.4"/>
      <line x1="0" y1="-${GLOBE_R}" x2="0" y2="${GLOBE_R}" stroke-opacity="0.4"/>
    </g>

    <circle cx="0" cy="0" r="${GLOBE_R}" fill="none" stroke="#ffffff" stroke-opacity="0.38" stroke-width="2"/>
  </g>

  <!-- Text block -->
  <text x="${MARGIN_X}" y="${rows.eyebrow.baseline}" font-family="${SANS}" font-size="19"
        font-weight="700" letter-spacing="5.5" fill="${FOREST}">OPENPLANETDATA</text>

  <text x="${MARGIN_X}" y="${rows.line1.baseline}" font-family="${DISPLAY}" font-size="70" fill="${INK}">Open data about</text>
  <text x="${MARGIN_X}" y="${rows.line2.baseline}" font-family="${DISPLAY}" font-size="70" fill="${INK}">planet Earth</text>

  <text x="${MARGIN_X}" y="${rows.subtitle.baseline}" font-family="${SANS}" font-size="24"
        font-weight="500" fill="${MUTED}">Boundaries · OpenStreetMap · Time zones · Postcodes</text>

  ${chipRow(rows.chips.top)}

  <text x="${MARGIN_X}" y="${rows.footnote.baseline}" font-family="${SANS}" font-size="19"
        font-weight="500" fill="${MUTED}">Free and open · No API keys · No rate limits</text>
</svg>`;
}

/**
 * Nominal row heights are not the same as rendered ink: cap heights, descenders
 * and the serif face's own metrics all shift the block by a few pixels. Rather
 * than bake in a magic offset that goes stale the moment the wording changes,
 * render once, measure where the ink actually landed, and correct.
 */
async function verticalDrift(png) {
	const COLUMN = 800; // text column only — the globe bleeds and would skew this
	const { data, info } = await sharp(png)
		.extract({ left: 0, top: 0, width: COLUMN, height: HEIGHT })
		.greyscale()
		.raw()
		.toBuffer({ resolveWithObject: true });

	let top = null;
	let bottom = null;
	for (let y = 0; y < info.height; y += 1) {
		let ink = 0;
		for (let x = 0; x < info.width; x += 1) {
			if (data[y * info.width + x] < 180) ink += 1;
		}
		if (ink > 3) {
			if (top === null) top = y;
			bottom = y;
		}
	}

	if (top === null) return 0;
	return (top + bottom) / 2 - HEIGHT / 2;
}

const probe = await sharp(Buffer.from(buildSvg(0))).png().toBuffer();
const drift = await verticalDrift(probe);

const buffer = await sharp(Buffer.from(buildSvg(-drift)))
	.png({ compressionLevel: 9 })
	.toBuffer();
writeFileSync(OUTPUT, buffer);

const residual = await verticalDrift(buffer);
console.log(
	`wrote ${OUTPUT} (${WIDTH}x${HEIGHT}, ${Math.round(buffer.length / 1024)} KB) ` +
		`— corrected ${drift.toFixed(1)}px, residual ${residual.toFixed(1)}px`,
);
