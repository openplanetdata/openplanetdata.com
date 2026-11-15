/**
 * A choropleth of the world for the statistics dashboard: one path per
 * country, shaded by a value.
 *
 * It is drawn by hand like the other charts, not with a map library: the
 * dashboard needs a static picture of ~170 shapes, and a tile-based map would
 * add a third-party request and megabytes of script for it.
 *
 * Shapes come from world-atlas (Natural Earth, 1:110m), which is keyed by ISO
 * numeric code; the statistics are keyed by alpha-2. Countries too small for
 * that scale (Monaco, Singapore, Luxembourg, ...) have no shape: the ranked
 * list and the table next to the map are where they show.
 */
import { svg, type TemplateResult } from 'lit';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { ALPHA2_BY_NUMERIC } from './country-numeric';

export interface CountryShape {
	/** ISO 3166-1 alpha-2 code; null for a disputed area the atlas gives no code. */
	code: string | null;
	name: string;
	/** Path data in the map's own coordinate space (MAP_VIEW_WIDTH wide). */
	path: string;
}

// Equal Earth projection (Šavrič, Patterson & Jenny, 2018): equal-area, so a
// shaded country weighs on the eye in proportion to its real size.
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

function project(lon: number, lat: number): [number, number] {
	const theta = Math.asin(M * Math.sin((lat * Math.PI) / 180));
	const theta2 = theta * theta;
	const theta6 = theta2 * theta2 * theta2;
	const x = ((lon * Math.PI) / 180) * Math.cos(theta) / (M * (A1 + 3 * A2 * theta2 + theta6 * (7 * A3 + 9 * A4 * theta2)));
	const y = theta * (A1 + A2 * theta2 + theta6 * (A3 + A4 * theta2));
	return [x, y];
}

// Antarctica is left out: nobody downloads from it, and it would take a fifth
// of the picture. The frame runs from just above Greenland to Cape Horn.
const ANTARCTICA = '010';
const NORTH = 84;
const SOUTH = -57;

const X_EXTENT = project(180, 0)[0];
const Y_NORTH = project(0, NORTH)[1];
const Y_SOUTH = project(0, SOUTH)[1];

export const MAP_VIEW_WIDTH = 1000;
const SCALE = MAP_VIEW_WIDTH / (2 * X_EXTENT);
export const MAP_VIEW_HEIGHT = Math.round((Y_NORTH - Y_SOUTH) * SCALE);

function toView(lon: number, lat: number): string {
	const [x, y] = project(lon, lat);
	return `${((x + X_EXTENT) * SCALE).toFixed(1)},${((Y_NORTH - y) * SCALE).toFixed(1)}`;
}

function ringPath(ring: number[][], shift = 0): string {
	return `M${ring.map(([lon, lat]) => toView(lon + shift, lat)).join('L')}Z`;
}

/**
 * The outline of the projected world between the two latitudes of the frame:
 * the meridians at -180° and +180°, which this projection curves inwards
 * towards the poles. Everything is clipped to it.
 */
const OUTLINE = (() => {
	const latitudes: number[] = [];
	for (let lat = SOUTH; lat <= NORTH; lat += 3) latitudes.push(lat);
	const west = latitudes.map((lat) => toView(-180, lat));
	const east = [...latitudes].reverse().map((lat) => toView(180, lat));
	return `M${[...west, ...east].join('L')}Z`;
})();

/**
 * A ring that crosses the antimeridian (Russia, Fiji) jumps from +180° to
 * -180° between two points, which would draw a line across the whole map. It is
 * unwrapped into one continuous outline running past the eastern edge, and
 * drawn a second time a full turn to the west: clipping to the outline of the
 * world leaves each part on its own side.
 */
function ringPaths(ring: number[][]): string {
	const crosses = ring.some((point, index) => index > 0 && Math.abs(point[0] - ring[index - 1][0]) > 180);
	if (!crosses) return ringPath(ring);

	const unwrapped = ring.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]);
	return ringPath(unwrapped) + ringPath(unwrapped, -360);
}

let shapes: Promise<CountryShape[]> | null = null;

/** The country shapes, loaded and projected once. The atlas is a separate chunk, fetched only when a map is shown. */
export function loadCountryShapes(): Promise<CountryShape[]> {
	shapes ??= import('world-atlas/countries-110m.json').then((module) => {
		const world = (module.default ?? module) as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
		const countries = feature(world, world.objects.countries);

		return countries.features
			.filter((country) => country.id !== ANTARCTICA)
			.map((country) => {
				const geometry = country.geometry;
				const polygons =
					geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
				return {
					code: ALPHA2_BY_NUMERIC[String(country.id)] ?? null,
					name: country.properties.name,
					path: polygons.map((polygon) => polygon.map(ringPaths).join('')).join(''),
				};
			});
	});
	return shapes;
}

export interface WorldMapOptions {
	width: number;
	shapes: CountryShape[];
	/** Value per alpha-2 code; a country without one is drawn empty. */
	values: Map<string, number>;
	/** Tooltip for a country, given its value (0 when it has none). */
	describe: (shape: CountryShape, value: number) => string;
}

/**
 * How strongly a country is shaded. Downloads are very unevenly spread, so the
 * scale is logarithmic: on a linear one, every country but the first two or
 * three would be indistinguishable from empty. The floor keeps a country with
 * a single download visibly apart from one with none.
 */
function shade(value: number, max: number): number {
	return 0.28 + 0.72 * (Math.log1p(value) / Math.log1p(Math.max(max, 1)));
}

export function worldMap({ width, shapes, values, describe }: WorldMapOptions): TemplateResult {
	const max = Math.max(...values.values(), 1);
	const height = Math.round((width * MAP_VIEW_HEIGHT) / MAP_VIEW_WIDTH);

	return svg`
		<svg class="chart-svg stats-map" width=${width} height=${height}
			viewBox=${`0 0 ${MAP_VIEW_WIDTH} ${MAP_VIEW_HEIGHT}`} role="img" aria-label="World map of downloads by country">
			<clipPath id="stats-map-outline"><path d=${OUTLINE} /></clipPath>
			<g clip-path="url(#stats-map-outline)">
				${shapes.map((shape) => {
					const value = shape.code ? (values.get(shape.code) ?? 0) : 0;
					return svg`
						<path class=${value > 0 ? 'map-country map-country-active' : 'map-country'} d=${shape.path}
							style=${value > 0 ? `fill-opacity:${shade(value, max).toFixed(2)}` : ''}>
							<title>${describe(shape, value)}</title>
						</path>`;
				})}
			</g>
		</svg>
	`;
}
