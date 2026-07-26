/**
 * Chart primitives for the stats dashboard.
 *
 * Everything is hand-rolled SVG against a single validated hue rather than a
 * charting library: the dashboard needs five shapes, and a library would cost
 * more bytes than the whole page.
 *
 * Colour policy — the story here is magnitude and trend, never identity, so
 * every mark uses one brand-forest ramp. That is what keeps the charts safe for
 * colour-vision deficiency without leaning on hue to carry meaning:
 *   light  #0f7a4a on #f2efe8 — 4.3:1, ordinal ramp light end 2.14:1
 *   dark   #37a06e on #17211b — 4.6:1
 * Both were checked with the data-viz palette validator (lightness band, chroma
 * floor, CVD separation, contrast). Adding a second hue means re-running it.
 */

import { svg, type TemplateResult } from 'lit';

export interface Point {
	day: number;
	value: number;
}

export interface BarItem {
	label: string;
	value: number;
	/** Optional second line under the label. */
	detail?: string;
}

/** Mark specs from the data-viz method: thin marks, hairline chrome. */
const BAR_MAX_THICKNESS = 24;
const BAR_RADIUS = 4;
const LINE_WIDTH = 2;

export interface AreaChartOptions {
	width: number;
	height: number;
	points: Point[];
	/** Index under the cursor, or null. */
	hover: number | null;
	formatValue: (value: number) => string;
	formatDay: (day: number) => string;
}

const AREA_PADDING = { top: 16, right: 8, bottom: 28, left: 56 };

export function areaChart({
	width,
	height,
	points,
	hover,
	formatValue,
	formatDay,
}: AreaChartOptions): TemplateResult {
	const plotWidth = Math.max(1, width - AREA_PADDING.left - AREA_PADDING.right);
	const plotHeight = Math.max(1, height - AREA_PADDING.top - AREA_PADDING.bottom);

	const max = Math.max(...points.map((p) => p.value), 0);
	const ticks = niceTicks(max);
	const scaleMax = ticks[ticks.length - 1] || 1;

	const x = (index: number) =>
		AREA_PADDING.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
	const y = (value: number) => AREA_PADDING.top + plotHeight - (value / scaleMax) * plotHeight;

	const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)}`).join(' ');
	const area = `${line} L${x(points.length - 1)},${AREA_PADDING.top + plotHeight} L${x(0)},${AREA_PADDING.top + plotHeight} Z`;

	const labelEvery = Math.max(1, Math.ceil(points.length / 6));

	return svg`
		<g class="chart-grid">
			${ticks.map(
				(tick) => svg`
					<line x1=${AREA_PADDING.left} x2=${AREA_PADDING.left + plotWidth} y1=${y(tick)} y2=${y(tick)} />
					<text class="chart-tick" x=${AREA_PADDING.left - 8} y=${y(tick) + 4} text-anchor="end">
						${formatValue(tick)}
					</text>`,
			)}
		</g>

		<path class="chart-area" d=${area} />
		<path class="chart-line" d=${line} stroke-width=${LINE_WIDTH} />

		<g class="chart-axis-x">
			${points.map((point, index) => {
				const isLast = index === points.length - 1;
				if (index % labelEvery !== 0 && !isLast) return null;
				// The end labels are anchored inward so they cannot overflow the
				// SVG on a narrow viewport.
				const anchor = index === 0 ? 'start' : isLast ? 'end' : 'middle';
				return svg`<text class="chart-tick" x=${x(index)} y=${height - 8} text-anchor=${anchor}>${formatDay(point.day)}</text>`;
			})}
		</g>

		${
			hover !== null && points[hover]
				? svg`
					<line class="chart-crosshair" x1=${x(hover)} x2=${x(hover)}
						y1=${AREA_PADDING.top} y2=${AREA_PADDING.top + plotHeight} />
					<circle class="chart-dot" cx=${x(hover)} cy=${y(points[hover]!.value)} r="4" />`
				: null
		}
	`;
}

/** Maps a pointer x offset to the nearest data index. */
export function nearestIndex(offsetX: number, width: number, count: number): number | null {
	if (count === 0) return null;
	const plotWidth = Math.max(1, width - AREA_PADDING.left - AREA_PADDING.right);
	const ratio = (offsetX - AREA_PADDING.left) / plotWidth;
	return Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1))));
}

/** Left edge of the plot area, so the tooltip can be positioned against it. */
export function plotX(index: number, width: number, count: number): number {
	const plotWidth = Math.max(1, width - AREA_PADDING.left - AREA_PADDING.right);
	return AREA_PADDING.left + (count <= 1 ? plotWidth / 2 : (index / (count - 1)) * plotWidth);
}

export interface BarChartOptions {
	width: number;
	items: BarItem[];
	formatValue: (value: number) => string;
	labelWidth?: number;
}

const BAR_ROW_HEIGHT = 44;
const BAR_VALUE_WIDTH = 84;

/**
 * Horizontal bars for nominal categories. Every bar takes the same hue: the
 * length already encodes the value, so colouring by size would spend the
 * identity channel restating it.
 */
export function barChart({ width, items, formatValue, labelWidth = 150 }: BarChartOptions): TemplateResult {
	const max = Math.max(...items.map((item) => item.value), 1);
	const trackWidth = Math.max(40, width - labelWidth - BAR_VALUE_WIDTH);
	const height = items.length * BAR_ROW_HEIGHT;

	return svg`
		<svg class="chart-svg" width=${width} height=${height} viewBox=${`0 0 ${width} ${height}`} role="presentation">
			${items.map((item, index) => {
				const rowY = index * BAR_ROW_HEIGHT;
				const barHeight = Math.min(BAR_MAX_THICKNESS, BAR_ROW_HEIGHT - 20);
				const barY = rowY + (BAR_ROW_HEIGHT - barHeight) / 2;
				const barWidth = Math.max(2, (item.value / max) * trackWidth);

				return svg`
					<text class="chart-bar-label" x="0" y=${rowY + BAR_ROW_HEIGHT / 2 + 4}>
						${truncate(item.label, labelWidth - 12)}
						<title>${item.label}</title>
					</text>
					<rect class="chart-bar" x=${labelWidth} y=${barY}
						width=${barWidth} height=${barHeight} rx=${BAR_RADIUS} />
					<text class="chart-bar-value" x=${labelWidth + barWidth + 10} y=${rowY + BAR_ROW_HEIGHT / 2 + 4}>
						${formatValue(item.value)}
					</text>`;
			})}
		</svg>
	`;
}

/**
 * SVG text has no `text-overflow`, so a long label would simply run under the
 * bars. Clipping the glyphs would be worse than shortening the string, and the
 * full text stays reachable through the <title> tooltip and the table view.
 */
const APPROX_CHAR_WIDTH = 6.8;

function truncate(label: string, availableWidth: number): string {
	const maxChars = Math.floor(availableWidth / APPROX_CHAR_WIDTH);
	if (maxChars < 4 || label.length <= maxChars) return label;
	return `${label.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * Nice round axis ticks (1/2/5 x 10^n) so the reader gets 0 / 500 / 1,000
 * rather than 0 / 437 / 874.
 */
export function niceTicks(max: number, count = 4): number[] {
	if (max <= 0) return [0, 1];

	const rawStep = max / count;
	const magnitude = 10 ** Math.floor(Math.log10(rawStep));
	const normalised = rawStep / magnitude;
	const step = (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10) * magnitude;

	const ticks: number[] = [];
	for (let tick = 0; tick <= max + step / 2; tick += step) {
		ticks.push(Math.round(tick * 1000) / 1000);
	}
	return ticks.length > 1 ? ticks : [0, step];
}
