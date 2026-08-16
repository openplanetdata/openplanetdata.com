/**
 * Schema.org JSON-LD emitted per page.
 *
 * The `Dataset` entries are the point of this file: Google Dataset Search is a
 * dedicated vertical that indexes exactly this markup, and a site whose whole
 * purpose is publishing datasets should be in it.
 *
 * Deliberately no `license` field. Google recommends one, but the site's own
 * pages disagree about the terms — `pipeline/data-sources.md` claims CC BY 4.0
 * while `llms.txt` and the dataset pages describe OpenStreetMap-derived data,
 * which carries ODbL share-alike. Publishing a machine-readable licence claim
 * while that is unresolved would be worse than publishing none, so the field is
 * left out until the source of truth is settled.
 */

const SITE = 'https://openplanetdata.com';
const DOWNLOADS = 'https://download.openplanetdata.com';

const PUBLISHER = {
	'@type': 'Organization',
	name: 'OpenPlanetData',
	url: SITE,
	logo: `${SITE}/logo.png`,
	sameAs: ['https://github.com/openplanetdata'],
};

/** Formats a dataset is published in, as MIME types schema.org understands. */
const MEDIA_TYPES: Record<string, string> = {
	geojson: 'application/geo+json',
	geopackage: 'application/geopackage+sqlite3',
	geoparquet: 'application/vnd.apache.parquet',
	pbf: 'application/x-protobuf',
	gol: 'application/octet-stream',
	gob: 'application/octet-stream',
};

interface DatasetEntry {
	name: string;
	description: string;
	keywords: string[];
	formats: string[];
	/** Where the files live, relative to the download origin. */
	path: string;
	source?: { name: string; url: string };
	frequency: string;
}

const DATASETS: Record<string, DatasetEntry> = {
	'/datasets/boundaries/continents/': {
		name: 'Continent Boundaries',
		description:
			'Continent and major world region boundary polygons covering the whole planet, published as GeoJSON, GeoPackage, and GeoParquet.',
		keywords: ['continents', 'boundaries', 'geospatial', 'GIS', 'polygons', 'world regions'],
		formats: ['geojson', 'geopackage', 'geoparquet'],
		path: 'boundaries/continents',
		source: { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
		frequency: 'P1D',
	},
	'/datasets/boundaries/countries/': {
		name: 'Country Boundaries',
		description:
			'Country and territory boundary polygons aligned with ISO 3166-1, covering every country on Earth, published as GeoJSON, GeoPackage, and GeoParquet.',
		keywords: ['countries', 'boundaries', 'ISO 3166-1', 'geospatial', 'GIS', 'administrative boundaries'],
		formats: ['geojson', 'geopackage', 'geoparquet'],
		path: 'boundaries/countries',
		source: { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
		frequency: 'P1D',
	},
	'/datasets/boundaries/regions/': {
		name: 'Region Boundaries',
		description:
			'First-level administrative subdivision boundaries aligned with ISO 3166-2, published as GeoJSON, GeoPackage, and GeoParquet.',
		keywords: ['regions', 'subdivisions', 'ISO 3166-2', 'boundaries', 'geospatial', 'GIS'],
		formats: ['geojson', 'geopackage', 'geoparquet'],
		path: 'boundaries/regions',
		source: { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
		frequency: 'P1D',
	},
	'/datasets/openstreetmap/planet/': {
		name: 'OpenStreetMap Planet Snapshots',
		description:
			'Daily snapshots of the complete OpenStreetMap planet, published as PBF, GOL, GOB, and GeoParquet for fast analytical queries.',
		keywords: ['OpenStreetMap', 'OSM', 'planet', 'PBF', 'GeoParquet', 'geospatial', 'GIS'],
		formats: ['pbf', 'gol', 'gob', 'geoparquet'],
		path: 'osm/planet',
		source: { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
		frequency: 'P1D',
	},
	'/datasets/openstreetmap/continents/': {
		name: 'OpenStreetMap Continent Extracts',
		description:
			'Daily OpenStreetMap extracts covering one continent each, cut from the planet snapshot and published as PBF, GOL, GOB, and GeoParquet.',
		keywords: ['OpenStreetMap', 'OSM', 'continents', 'extracts', 'PBF', 'GeoParquet', 'geospatial', 'GIS'],
		formats: ['pbf', 'gol', 'gob', 'geoparquet'],
		path: 'osm/continents',
		source: { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
		frequency: 'P1D',
	},
	'/datasets/openstreetmap/countries/': {
		name: 'OpenStreetMap Country Extracts',
		description:
			'Daily OpenStreetMap extracts covering one country or territory each, aligned with ISO 3166-1 and published as PBF, GOL, GOB, and GeoParquet.',
		keywords: ['OpenStreetMap', 'OSM', 'countries', 'extracts', 'ISO 3166-1', 'PBF', 'GeoParquet', 'geospatial', 'GIS'],
		formats: ['pbf', 'gol', 'gob', 'geoparquet'],
		path: 'osm/countries',
		source: { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
		frequency: 'P1D',
	},
	'/datasets/time-zones/': {
		name: 'Time Zone Boundaries',
		description:
			'Time zone boundary polygons for the whole planet, built from timezone-boundary-builder and published as GeoParquet for fast point-in-polygon lookups.',
		keywords: ['time zones', 'timezone', 'boundaries', 'IANA', 'geospatial', 'GIS'],
		formats: ['geoparquet'],
		path: 'tz',
		source: {
			name: 'timezone-boundary-builder',
			url: 'https://github.com/evansiroky/timezone-boundary-builder',
		},
		frequency: 'P1D',
	},
};

function datasetSchema(url: string, entry: DatasetEntry) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Dataset',
		name: entry.name,
		description: entry.description,
		url: `${SITE}${url}`,
		keywords: entry.keywords,
		creator: PUBLISHER,
		publisher: PUBLISHER,
		isAccessibleForFree: true,
		// The datasets are global by definition.
		spatialCoverage: {
			'@type': 'Place',
			geo: {
				'@type': 'GeoShape',
				box: '-90 -180 90 180',
			},
		},
		...(entry.source
			? { isBasedOn: { '@type': 'CreativeWork', name: entry.source.name, url: entry.source.url } }
			: {}),
		distribution: entry.formats.map((format) => ({
			'@type': 'DataDownload',
			encodingFormat: MEDIA_TYPES[format] ?? 'application/octet-stream',
			contentUrl: `${DOWNLOADS}/${entry.path}`,
		})),
	};
}

function catalogSchema() {
	return {
		'@context': 'https://schema.org',
		'@type': 'DataCatalog',
		name: 'OpenPlanetData',
		description:
			'Open, free, and regularly rebuilt geographic datasets about planet Earth — boundaries, OpenStreetMap snapshots, time zones, and postcodes.',
		url: `${SITE}/datasets/`,
		publisher: PUBLISHER,
		isAccessibleForFree: true,
		dataset: Object.entries(DATASETS).map(([path, entry]) => ({
			'@type': 'Dataset',
			name: entry.name,
			description: entry.description,
			url: `${SITE}${path}`,
		})),
	};
}

function siteSchema() {
	return [
		{
			'@context': 'https://schema.org',
			'@type': 'Organization',
			...PUBLISHER,
			description:
				'OpenPlanetData publishes free, open geographic datasets about planet Earth, distributed from a global Cloudflare R2 mirror with no API keys and no rate limits.',
		},
		{
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: 'OpenPlanetData',
			url: SITE,
			publisher: PUBLISHER,
		},
	];
}

/** JSON-LD blocks for a given pathname; empty for pages that need none. */
export function structuredDataFor(pathname: string): object[] {
	const path = pathname.endsWith('/') ? pathname : `${pathname}/`;

	if (path === '/') return siteSchema();
	if (path === '/datasets/') return [catalogSchema()];

	const entry = DATASETS[path];
	return entry ? [datasetSchema(path, entry)] : [];
}
