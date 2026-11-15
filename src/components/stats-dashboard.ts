import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { areaChart, barChart, nearestIndex, plotX, type BarItem, type Point } from './stats-charts';
import { loadCountryShapes, worldMap, type CountryShape } from './stats-map';

interface Totals {
	downloads: number;
	/** Partial downloads: requests for byte ranges of a file, counted apart from downloads. */
	partial_reads: number;
	visitors: number;
	bytes: number;
}

interface SeriesPoint extends Totals {
	day: number;
}

interface Breakdown {
	label: string;
	downloads: number;
	bytes: number;
}

interface ClientBreakdown extends Breakdown {
	partial_reads: number;
}

interface CountryBreakdown {
	/** ISO 3166-1 alpha-2. */
	code: string;
	downloads: number;
	partial_reads: number;
}

interface TopEntry extends Breakdown {
	path: string;
	category: string;
	entity: string;
	extension: string;
}

interface FeedbackTotals {
	responses: number;
	helpful: number;
}

interface StatsPayload {
	generated_at: number;
	period: { key: string; days: number; since: number };
	unavailable: string[];
	catalog: { files: number; bytes: number; categories: number; updated: number } | null;
	downloads: {
		all_time: Totals;
		period: Totals;
		previous: Totals;
		series: SeriesPoint[];
		by_category: Breakdown[];
		by_format: Breakdown[];
		by_client: ClientBreakdown[];
		by_country: CountryBreakdown[];
		top: TopEntry[];
	} | null;
	feedback: {
		all_time: FeedbackTotals;
		period: FeedbackTotals;
		series: Array<{ day: number; responses: number; helpful: number }>;
		by_page: Array<{ page: string; responses: number; helpful: number }>;
		by_country: Array<{ code: string; responses: number; helpful: number }>;
	} | null;
}

const PERIODS = [
	{ key: '7d', label: '7 days' },
	{ key: '30d', label: '30 days' },
	{ key: '90d', label: '90 days' },
	{ key: '365d', label: '12 months' },
];

type Metric = 'downloads' | 'partial_reads' | 'bytes' | 'visitors';

const METRICS: Array<{ key: Metric; label: string }> = [
	{ key: 'downloads', label: 'Downloads' },
	{ key: 'partial_reads', label: 'Partial downloads' },
	{ key: 'bytes', label: 'Data served' },
	{ key: 'visitors', label: 'Unique clients' },
];

const CATEGORY_LABELS: Record<string, string> = {
	openstreetmap: 'OpenStreetMap',
	boundaries: 'Boundaries',
	timezone: 'Time zones',
	postcodes: 'Postcodes',
	coastline: 'Coastline',
	unknown: 'No longer published',
};

// Names for the tools the download service recognises. A tool that declares
// its own label with ?client= is shown under that label.
const CLIENT_LABELS: Record<string, string> = {
	browser: 'Web browsers',
	rclone: 'rclone',
	curl: 'curl',
	wget: 'Wget',
	aria2: 'aria2',
	'python-requests': 'Python (requests)',
	aiohttp: 'Python (aiohttp)',
	okhttp: 'OkHttp (Java, Android)',
	node: 'Node.js',
	duckdb: 'DuckDB',
	gdal: 'GDAL',
	'geodesk-gol': 'GeoDesk GOL',
	unidentified: 'No user agent',
	other: 'Other tools',
};

const FORMAT_LABELS: Record<string, string> = {
	parquet: 'GeoParquet',
	geojson: 'GeoJSON',
	gpkg: 'GeoPackage',
	pbf: 'OSM PBF',
	gol: 'GOL',
	gob: 'GOB',
	unknown: 'No longer published',
};

/** Path segments whose slug does not title-case into something readable. */
const PATH_LABELS: Record<string, string> = {
	osm: 'OpenStreetMap',
	tz: 'Time zones',
	geoparquet: 'GeoParquet',
	geopackage: 'GeoPackage',
	geojson: 'GeoJSON',
};

const CHART_HEIGHT = 260;

@customElement('stats-dashboard')
export class StatsDashboardElement extends LitElement {
	@state() accessor _data: StatsPayload | null = null;
	@state() accessor _loading = true;
	@state() accessor _error = false;
	@state() accessor _period = '90d';
	@state() accessor _metric: Metric = 'downloads';
	@state() accessor _hover: number | null = null;
	@state() accessor _width = 720;
	/** Charts showing their table twin instead of the plot. */
	@state() accessor _tables = new Set<string>();
	/** Country outlines for the map; loaded the first time there is something to show on it. */
	@state() accessor _shapes: CountryShape[] | null = null;

	private _observer: ResizeObserver | null = null;

	/** Light DOM so the site's theme tokens and fonts apply unchanged. */
	createRenderRoot() {
		return this;
	}

	connectedCallback() {
		super.connectedCallback();
		void this.fetchData();

		// Rendering at the true pixel width keeps SVG text crisp instead of
		// scaling a fixed viewBox up and blurring every label.
		this._observer = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			if (width > 0) this._width = width;
		});
		this._observer.observe(this);
	}

	disconnectedCallback() {
		super.disconnectedCallback();
		this._observer?.disconnect();
		this._observer = null;
	}

	private async fetchData() {
		this._loading = true;
		this._error = false;
		try {
			const response = await fetch(`/api/stats?period=${this._period}`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			this._data = (await response.json()) as StatsPayload;
			if (this._shapes === null && (this._data.downloads?.by_country?.length ?? 0) > 0) {
				// The map is an extra: if the outlines fail to load, the ranked list still shows.
				loadCountryShapes().then((shapes) => { this._shapes = shapes; }).catch(() => {});
			}
		} catch {
			this._error = true;
		} finally {
			this._loading = false;
		}
	}

	private onPeriod(key: string) {
		if (key === this._period) return;
		this._period = key;
		this._hover = null;
		void this.fetchData();
	}

	private toggleTable(id: string) {
		const next = new Set(this._tables);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		this._tables = next;
	}

	// --- Formatting ---

	private compact(value: number): string {
		if (value < 1000) return String(Math.round(value));
		if (value < 1_000_000) return `${trim(value / 1000)}K`;
		if (value < 1_000_000_000) return `${trim(value / 1_000_000)}M`;
		return `${trim(value / 1_000_000_000)}B`;
	}

	private full(value: number): string {
		return Math.round(value).toLocaleString('en-US');
	}

	private bytes(value: number): string {
		const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
		let size = value;
		let unit = 0;
		while (size >= 1024 && unit < units.length - 1) {
			size /= 1024;
			unit += 1;
		}
		return `${trim(size)} ${units[unit]}`;
	}

	private formatMetric(value: number, metric: Metric = this._metric): string {
		return metric === 'bytes' ? this.bytes(value) : this.compact(value);
	}

	private day(day: number): string {
		return new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
	}

	private fullDay(day: number): string {
		return new Date(day).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC',
		});
	}

	// --- Templates ---

	private renderFilters() {
		return html`
			<div class="stats-filters" role="group" aria-label="Reporting period">
				<span class="stats-filters-label">Period</span>
				${PERIODS.map(
					(period) => html`
						<button
							type="button"
							class="stats-chip ${period.key === this._period ? 'active' : ''}"
							aria-pressed=${period.key === this._period}
							@click=${() => this.onPeriod(period.key)}
						>${period.label}</button>`,
				)}
			</div>
		`;
	}

	private renderHero(data: StatsPayload) {
		const downloads = data.downloads;
		if (!downloads) return nothing;

		return html`
			<div class="stats-hero">
				<div class="stats-hero-figure">${this.full(downloads.all_time.downloads)}</div>
				<div class="stats-hero-label">
					files downloaded since day one &mdash;
					<strong>${this.bytes(downloads.all_time.bytes)}</strong> shipped to
					<strong>${this.full(downloads.all_time.visitors)}</strong> unique clients
				</div>
			</div>
		`;
	}

	private renderDelta(current: number, previous: number) {
		if (previous <= 0) return nothing;
		const change = ((current - previous) / previous) * 100;
		if (!Number.isFinite(change)) return nothing;

		const rounded = Math.round(change);
		const direction = rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
		const arrow = rounded > 0 ? '↑' : rounded < 0 ? '↓' : '→';

		return html`
			<span class="stats-tile-delta" data-direction=${direction}>
				${arrow} ${Math.abs(rounded)}% <span class="stats-tile-delta-note">vs previous period</span>
			</span>
		`;
	}

	private renderTiles(data: StatsPayload) {
		const downloads = data.downloads;
		if (!downloads) return nothing;

		const { period, previous } = downloads;

		return html`
			<div class="stats-tiles">
				<div class="stats-tile">
					<span class="stats-tile-label">Downloads</span>
					<span class="stats-tile-value">${this.full(period.downloads)}</span>
					${this.renderDelta(period.downloads, previous.downloads)}
				</div>
				<div class="stats-tile">
					<span class="stats-tile-label">Partial downloads</span>
					<span class="stats-tile-value">${this.full(period.partial_reads)}</span>
					${this.renderDelta(period.partial_reads, previous.partial_reads)}
					<span class="stats-tile-delta-note">byte ranges of a file</span>
				</div>
				<div class="stats-tile">
					<span class="stats-tile-label">Data served</span>
					<span class="stats-tile-value">${this.bytes(period.bytes)}</span>
					${this.renderDelta(period.bytes, previous.bytes)}
				</div>
				<div class="stats-tile">
					<span class="stats-tile-label">Unique clients</span>
					<span class="stats-tile-value">${this.full(period.visitors)}</span>
					${this.renderDelta(period.visitors, previous.visitors)}
				</div>
				<div class="stats-tile">
					<span class="stats-tile-label">Files published</span>
					<span class="stats-tile-value">${this.full(data.catalog?.files ?? 0)}</span>
					<span class="stats-tile-delta-note">
						${this.bytes(data.catalog?.bytes ?? 0)} in the catalog
					</span>
				</div>
			</div>
		`;
	}

	private renderCard(
		id: string,
		title: string,
		subtitle: string,
		body: TemplateResult | typeof nothing,
		table: TemplateResult | typeof nothing,
		extra: TemplateResult | typeof nothing = nothing,
	) {
		const showTable = this._tables.has(id);
		return html`
			<section class="stats-card">
				${this.renderViewToggle(id, showTable)}
				<header class="stats-card-head">
					<h2 class="stats-card-title">${title}</h2>
					<p class="stats-card-subtitle">${subtitle}</p>
				</header>
				${extra === nothing ? nothing : html`<div class="stats-card-controls">${extra}</div>`}
				${showTable ? table : body}
			</section>
		`;
	}

	/**
	 * Pinned to the card corner rather than sitting in the control row: it
	 * switches how this card is rendered, which is a different kind of action
	 * from the filters that change what the data covers.
	 */
	private renderViewToggle(id: string, showTable: boolean) {
		const label = showTable ? 'Show chart' : 'Show table';
		return html`
			<button
				type="button"
				class="stats-view-toggle"
				aria-pressed=${showTable}
				aria-label=${label}
				data-tip=${label}
				@click=${() => this.toggleTable(id)}
			>
				${showTable
					? html`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
							stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<polyline points="3 17 9 11 13 15 21 7"></polyline>
							<polyline points="15 7 21 7 21 13"></polyline>
						</svg>`
					: html`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
							stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<rect x="3" y="4" width="18" height="16" rx="2"></rect>
							<line x1="3" y1="9.5" x2="21" y2="9.5"></line>
							<line x1="9.5" y1="9.5" x2="9.5" y2="20"></line>
						</svg>`}
			</button>
		`;
	}

	private renderTimeChart(data: StatsPayload) {
		const downloads = data.downloads;
		if (!downloads) return nothing;

		const series = downloads.series;
		const points: Point[] = series.map((entry) => ({ day: entry.day, value: entry[this._metric] }));
		const width = Math.max(320, this._width);
		const hovered = this._hover !== null ? series[this._hover] : undefined;

		const metricPicker = html`
			<div class="stats-metric-picker">
				${METRICS.map(
					(metric) => html`
						<button
							type="button"
							class="stats-chip stats-chip-sm ${metric.key === this._metric ? 'active' : ''}"
							aria-pressed=${metric.key === this._metric}
							@click=${() => {
								this._metric = metric.key;
							}}
						>${metric.label}</button>`,
				)}
			</div>
		`;

		const chart = html`
			<div class="stats-chart-wrap">
				<svg
					class="chart-svg"
					width=${width}
					height=${CHART_HEIGHT}
					viewBox=${`0 0 ${width} ${CHART_HEIGHT}`}
					role="img"
					aria-label=${`${METRICS.find((m) => m.key === this._metric)?.label} per day`}
					@pointermove=${(event: PointerEvent) => {
						const bounds = (event.currentTarget as SVGElement).getBoundingClientRect();
						this._hover = nearestIndex(event.clientX - bounds.left, width, points.length);
					}}
					@pointerleave=${() => {
						this._hover = null;
					}}
				>
					${areaChart({
						width,
						height: CHART_HEIGHT,
						points,
						hover: this._hover,
						formatValue: (value) => this.formatMetric(value),
						formatDay: (day) => this.day(day),
					})}
				</svg>
				${
					hovered
						? html`
							<div
								class="stats-tooltip"
								style=${`left:${plotX(this._hover!, width, points.length)}px`}
								data-flip=${plotX(this._hover!, width, points.length) > width * 0.6}
							>
								<div class="stats-tooltip-day">${this.fullDay(hovered.day)}</div>
								<div class="stats-tooltip-row"><span>Downloads</span><strong>${this.full(hovered.downloads)}</strong></div>
								<div class="stats-tooltip-row"><span>Partial downloads</span><strong>${this.full(hovered.partial_reads)}</strong></div>
								<div class="stats-tooltip-row"><span>Data served</span><strong>${this.bytes(hovered.bytes)}</strong></div>
								<div class="stats-tooltip-row"><span>Unique clients</span><strong>${this.full(hovered.visitors)}</strong></div>
							</div>`
						: nothing
				}
			</div>
		`;

		const table = html`
			<div class="stats-table-wrap">
				<table class="stats-table">
					<thead>
						<tr><th scope="col">Day</th><th scope="col">Downloads</th><th scope="col">Partial downloads</th><th scope="col">Data served</th><th scope="col">Unique clients</th></tr>
					</thead>
					<tbody>
						${[...series].reverse().map(
							(entry) => html`
								<tr>
									<th scope="row">${this.fullDay(entry.day)}</th>
									<td>${this.full(entry.downloads)}</td>
									<td>${this.full(entry.partial_reads)}</td>
									<td>${this.bytes(entry.bytes)}</td>
									<td>${this.full(entry.visitors)}</td>
								</tr>`,
						)}
					</tbody>
				</table>
			</div>
		`;

		return this.renderCard(
			'series',
			'Downloads over time',
			`Daily totals across the last ${data.period.days} days. Hover for the exact figures.`,
			chart,
			table,
			metricPicker,
		);
	}

	private renderBreakdown(
		id: string,
		title: string,
		subtitle: string,
		rows: Breakdown[],
		labels: Record<string, string>,
	) {
		if (rows.length === 0) return nothing;

		const items: BarItem[] = rows.map((row) => ({
			label: labels[row.label] ?? row.label,
			value: row.downloads,
		}));
		const width = Math.max(280, this._width / 2 - 40);

		const chart = html`
			<div class="stats-chart-wrap">
				${barChart({ width, items, formatValue: (value) => this.compact(value), labelWidth: 140 })}
			</div>
		`;

		const table = html`
			<div class="stats-table-wrap">
				<table class="stats-table">
					<thead>
						<tr><th scope="col">${title}</th><th scope="col">Downloads</th><th scope="col">Data served</th></tr>
					</thead>
					<tbody>
						${rows.map(
							(row) => html`
								<tr>
									<th scope="row">${labels[row.label] ?? row.label}</th>
									<td>${this.full(row.downloads)}</td>
									<td>${this.bytes(row.bytes)}</td>
								</tr>`,
						)}
					</tbody>
				</table>
			</div>
		`;

		return this.renderCard(id, title, subtitle, chart, table);
	}

	/**
	 * The width a chart gets inside a card of the two-column grid. The grid
	 * (.stats-grid-2) puts two cards side by side when each has 20rem, with a
	 * 1.5rem gap, and stacks them otherwise; a card has 25px of padding a side.
	 */
	private gridChartWidth(): number {
		const sideBySide = this._width >= 664;
		const card = sideBySide ? (this._width - 24) / 2 : this._width;
		return Math.max(280, card - 50);
	}

	private renderDownloadCountries(data: StatsPayload) {
		const rows = data.downloads?.by_country ?? [];
		if (rows.length === 0) return nothing;

		const total = (row: CountryBreakdown) => row.downloads + row.partial_reads;
		const values = new Map(rows.map((row) => [row.code, total(row)]));
		const byCode = new Map(rows.map((row) => [row.code, row]));

		// A country's share of the requests whose country is known.
		const located = rows.reduce((sum, row) => sum + total(row), 0);
		const share = (value: number) => {
			const percent = located > 0 ? (value / located) * 100 : 0;
			if (percent > 0 && percent < 0.5) return '<1%';
			return `${Math.round(percent)}%`;
		};

		// The map and the ranked list sit side by side when the card is wide enough.
		const inner = Math.max(280, this._width - 50);
		const sideBySide = inner >= 760;
		const mapWidth = sideBySide ? Math.round(inner * 0.55) : inner;
		const listWidth = sideBySide ? inner - mapWidth - 32 : inner;

		const describe = (shape: CountryShape, value: number) => {
			const name = shape.code ? countryName(shape.code) : shape.name;
			if (value === 0 || !shape.code) return `${name}: none`;
			const row = byCode.get(shape.code)!;
			const parts = [`${this.full(row.downloads)} ${row.downloads === 1 ? 'download' : 'downloads'}`];
			if (row.partial_reads > 0) {
				parts.push(`${this.full(row.partial_reads)} partial ${row.partial_reads === 1 ? 'download' : 'downloads'}`);
			}
			return `${name}: ${parts.join(', ')} (${share(value)})`;
		};

		const items: BarItem[] = rows.slice(0, 8).map((row) => ({
			label: countryName(row.code),
			value: total(row),
			icon: countryFlag(row.code),
			note: share(total(row)),
		}));

		const chart = html`
			<div class="stats-map-layout" data-side-by-side=${sideBySide}>
				<div class="stats-map-wrap" style=${`width:${mapWidth}px`}>
					${this._shapes
						? worldMap({ width: mapWidth, shapes: this._shapes, values, describe })
						: nothing}
				</div>
				<div class="stats-chart-wrap">
					${barChart({
						width: listWidth,
						items,
						formatValue: (value) => this.compact(value),
						labelWidth: Math.min(170, Math.max(130, listWidth * 0.38)),
						valueWidth: 58,
					})}
				</div>
			</div>
		`;

		const table = html`
			<div class="stats-table-wrap">
				<table class="stats-table">
					<thead>
						<tr><th scope="col">Country</th><th scope="col">Downloads</th><th scope="col">Partial downloads</th><th scope="col">Share</th></tr>
					</thead>
					<tbody>
						${rows.map(
							(row) => html`
								<tr>
									<th scope="row">${this.renderCountry(row.code)}</th>
									<td>${this.full(row.downloads)}</td>
									<td>${this.full(row.partial_reads)}</td>
									<td>${share(total(row))}</td>
								</tr>`,
						)}
					</tbody>
				</table>
			</div>
		`;

		return this.renderCard(
			'download-country',
			'Where downloads come from',
			`Countries the files were fetched from, over the last ${data.period.days} days: downloads and partial downloads together. Recorded since 15 November 2026, from the connection and never from an address we keep.`,
			chart,
			table,
		);
	}

	private renderClients(data: StatsPayload) {
		const clients = data.downloads?.by_client ?? [];
		if (clients.length === 0) return nothing;

		const name = (row: ClientBreakdown) => CLIENT_LABELS[row.label] ?? row.label;
		const items: BarItem[] = clients.map((row) => ({
			label: name(row),
			value: row.downloads + row.partial_reads,
		}));

		const width = this.gridChartWidth();
		const chart = html`
			<div class="stats-chart-wrap">
				${barChart({
					width,
					items,
					formatValue: (value) => this.compact(value),
					labelWidth: Math.min(200, Math.max(140, width * 0.4)),
				})}
			</div>
		`;

		const table = html`
			<div class="stats-table-wrap">
				<table class="stats-table">
					<thead>
						<tr><th scope="col">Client</th><th scope="col">Downloads</th><th scope="col">Partial downloads</th><th scope="col">Data served</th></tr>
					</thead>
					<tbody>
						${clients.map(
							(row) => html`
								<tr>
									<th scope="row">${name(row)}</th>
									<td>${this.full(row.downloads)}</td>
									<td>${this.full(row.partial_reads)}</td>
									<td>${row.downloads > 0 ? this.bytes(row.bytes) : html`<span title="Not measured for partial downloads">—</span>`}</td>
								</tr>`,
						)}
					</tbody>
				</table>
			</div>
		`;

		return this.renderCard(
			'client',
			'By client',
			`The tools that fetch the data, over the last ${data.period.days} days: downloads and partial downloads together. A tool is named once three clients use it.`,
			chart,
			table,
		);
	}

	private renderTop(data: StatsPayload) {
		const top = data.downloads?.top ?? [];
		if (top.length === 0) return nothing;

		const items: BarItem[] = top.map((entry) => ({
			label: this.topLabel(entry),
			value: entry.downloads,
		}));

		const width = this.gridChartWidth();
		const chart = html`
			<div class="stats-chart-wrap">
				${barChart({
					width,
					items,
					formatValue: (value) => this.compact(value),
					labelWidth: Math.min(250, Math.max(150, width * 0.54)),
				})}
			</div>
		`;

		const table = html`
			<div class="stats-table-wrap">
				<table class="stats-table">
					<thead>
						<tr><th scope="col">File</th><th scope="col">Path</th><th scope="col">Downloads</th><th scope="col">Data served</th></tr>
					</thead>
					<tbody>
						${top.map(
							(entry) => html`
								<tr>
									<th scope="row">${this.topLabel(entry)}</th>
									<td><code>${entry.path}</code></td>
									<td>${this.full(entry.downloads)}</td>
									<td>${this.bytes(entry.bytes)}</td>
								</tr>`,
						)}
					</tbody>
				</table>
			</div>
		`;

		return this.renderCard(
			'top',
			'Most downloaded',
			`The files people actually pull, over the last ${data.period.days} days.`,
			chart,
			table,
		);
	}

	/**
	 * Built from the R2 path rather than the catalog entity name: several
	 * distinct files share the entity "planet", so entity names alone render as
	 * five identical rows.
	 */
	private topLabel(entry: TopEntry): string {
		const format = FORMAT_LABELS[entry.extension] ?? entry.extension.toUpperCase();

		// Last segment is the format folder, which the suffix already states.
		const segments = entry.path.split('/').filter(Boolean).slice(0, -1);

		// "planet" means "the whole world" and only carries meaning when it is
		// the sole descriptor; elsewhere it is noise repeated on every row.
		const meaningful = segments.length > 2 ? segments.filter((part) => part !== 'planet') : segments;

		const name = meaningful.map((part) => PATH_LABELS[part] ?? titleCase(part)).join(' ');
		return name ? `${name} · ${format}` : format;
	}

	private renderFeedback(data: StatsPayload) {
		const feedback = data.feedback;
		if (!feedback) {
			return this.renderCard(
				'feedback',
				'Page feedback',
				'Reader votes from the "Was this page helpful?" widget.',
				html`<p class="stats-empty">Feedback figures are temporarily unavailable.</p>`,
				nothing,
			);
		}

		const { responses, helpful } = feedback.period;
		if (responses === 0) {
			return this.renderCard(
				'feedback',
				'Page feedback',
				'Reader votes from the "Was this page helpful?" widget.',
				html`<p class="stats-empty">No votes in this period yet. The widget sits at the bottom of every page.</p>`,
				nothing,
			);
		}

		const share = helpful / responses;
		const pages = [...feedback.by_page].sort((a, b) => b.responses - a.responses);

		// A single ratio against a limit is a meter, not a two-slice pie. The
		// track is a lighter step of the same hue so the whole bar reads as one
		// scale, and the figure is spelled out beside it — never colour alone.
		const meter = html`
			<div class="stats-meter-block">
				<div class="stats-meter-head">
					<span class="stats-meter-value">${Math.round(share * 100)}%</span>
					<span class="stats-meter-label">
						found these pages helpful
						<span class="stats-meter-note">${this.full(helpful)} of ${this.full(responses)} votes</span>
					</span>
				</div>
				<div class="stats-meter" role="img"
					aria-label=${`${Math.round(share * 100)} percent of ${responses} votes were positive`}>
					<div class="stats-meter-fill" style=${`width:${Math.max(1, share * 100)}%`}></div>
				</div>
			</div>

			<div class="stats-table-wrap">
				<table class="stats-table">
					<thead>
						<tr><th scope="col">Page</th><th scope="col">Helpful</th><th scope="col">Votes</th><th scope="col">Score</th></tr>
					</thead>
					<tbody>
						${pages.map((page) => {
							const pageShare = page.responses > 0 ? page.helpful / page.responses : 0;
							return html`
								<tr>
									<th scope="row"><a href=${page.page}>${page.page}</a></th>
									<td>${this.full(page.helpful)}</td>
									<td>${this.full(page.responses)}</td>
									<td>
										<span class="stats-row-meter">
											<span class="stats-row-meter-fill" style=${`width:${Math.max(2, pageShare * 100)}%`}></span>
										</span>
										<span class="stats-row-score">${Math.round(pageShare * 100)}%</span>
									</td>
								</tr>`;
						})}
					</tbody>
				</table>
			</div>
		`;

		return html`
			<section class="stats-card">
				<header class="stats-card-head">
					<h2 class="stats-card-title">Page feedback</h2>
					<p class="stats-card-subtitle">
						Reader votes from the &ldquo;Was this page helpful?&rdquo; widget over the last
						${data.period.days} days. Written comments stay private.
					</p>
				</header>
				${meter}
			</section>
		`;
	}

	/**
	 * Only the feedback widget records a country — the download log stores just
	 * the raw address — so this counts readers who voted, not people who pulled
	 * data. The card stays hidden until somebody has actually voted, rather than
	 * publishing an empty chart.
	 */
	/** A country name with its flag, for a table cell. */
	private renderCountry(code: string) {
		const flag = countryFlag(code);
		return html`<span class="stats-country">
			${flag
				? html`<img class="stats-flag" src=${flag} alt="" width="22" height="22" loading="lazy"
						@error=${(event: Event) => (event.target as HTMLElement).remove()} />`
				: nothing}${countryName(code)}
		</span>`;
	}

	private renderCountries(data: StatsPayload) {
		const rows = (data.feedback?.by_country ?? []).filter((row) => row.responses > 0);
		if (rows.length === 0) return nothing;

		const items: BarItem[] = rows.map((row) => ({
			label: countryName(row.code),
			value: row.responses,
			icon: countryFlag(row.code),
		}));

		const chart = html`
			<div class="stats-chart-wrap">
				${barChart({
					width: Math.max(280, this._width),
					items,
					formatValue: (value) => this.compact(value),
					labelWidth: Math.min(240, Math.max(140, this._width * 0.28)),
				})}
			</div>
		`;

		const table = html`
			<div class="stats-table-wrap">
				<table class="stats-table">
					<thead>
						<tr><th scope="col">Country</th><th scope="col">Votes</th><th scope="col">Helpful</th><th scope="col">Score</th></tr>
					</thead>
					<tbody>
						${rows.map((row) => {
							const share = row.responses > 0 ? row.helpful / row.responses : 0;
							return html`
								<tr>
									<th scope="row">${this.renderCountry(row.code)}</th>
									<td>${this.full(row.responses)}</td>
									<td>${this.full(row.helpful)}</td>
									<td>${Math.round(share * 100)}%</td>
								</tr>`;
						})}
					</tbody>
				</table>
			</div>
		`;

		return this.renderCard(
			'country',
			'Where readers are',
			`Countries the feedback came from, over the last ${data.period.days} days. Derived from the request, never from anything the reader submits.`,
			chart,
			table,
		);
	}

	private renderSkeleton() {
		return html`
			<div class="stats-filters"><span class="stats-skeleton stats-skeleton-chip"></span></div>
			<div class="stats-hero"><span class="stats-skeleton stats-skeleton-hero"></span></div>
			<div class="stats-tiles">
				${[0, 1, 2, 3].map(() => html`<div class="stats-tile"><span class="stats-skeleton stats-skeleton-tile"></span></div>`)}
			</div>
			<section class="stats-card"><span class="stats-skeleton stats-skeleton-chart"></span></section>
		`;
	}

	render() {
		if (this._loading && !this._data) return this.renderSkeleton();

		if (this._error || !this._data) {
			return html`
				<div class="stats-card">
					<p class="stats-empty">
						Statistics could not be loaded right now. Please try again shortly.
					</p>
				</div>
			`;
		}

		const data = this._data;
		const downloadsMissing = data.downloads === null;

		return html`
			${this.renderFilters()}
			${downloadsMissing
				? html`<div class="stats-card"><p class="stats-empty">Download figures are temporarily unavailable.</p></div>`
				: html`
					${this.renderHero(data)}
					${this.renderTiles(data)}
					${this.renderTimeChart(data)}
					<div class="stats-grid-2">
						${this.renderTop(data)}
						${this.renderClients(data)}
					</div>
					<div class="stats-grid-2">
						${this.renderBreakdown(
							'category',
							'By dataset',
							'Which collections get pulled.',
							data.downloads!.by_category,
							CATEGORY_LABELS,
						)}
						${this.renderBreakdown(
							'format',
							'By format',
							'How people prefer their data.',
							data.downloads!.by_format,
							FORMAT_LABELS,
						)}
					</div>
					${this.renderDownloadCountries(data)}`}
			${this.renderFeedback(data)}
			${this.renderCountries(data)}
			<p class="stats-footnote">
				Figures are cached for up to 5 minutes · generated ${this.fullDay(data.generated_at)}.
				Download counts come from request logs, at most one per client and file
				per hour. A partial download, where a tool fetches only byte ranges of a
				file, is counted apart. Data served is the sum of the published sizes
				of the downloaded files: what partial downloads transfer is not
				measured, and resumed transfers are approximated. What our own build
				pipelines fetch is left out.
			</p>
		`;
	}
}

/** One decimal, but only when it earns its place: 1.5 K yet 12 K, not 12.0 K. */
function trim(value: number): string {
	return value >= 10 || Number.isInteger(value) ? String(Math.round(value)) : value.toFixed(1);
}

/**
 * `XX` is what the query substitutes when Cloudflare could not place the
 * request — Tor exits report `T1`, and both should read as words rather than
 * as codes.
 */
const COUNTRY_FALLBACKS: Record<string, string> = {
	XX: 'Unknown',
	T1: 'Tor network',
};

/**
 * The flag of a country, from Ipregistry's flag assets. None for a code that
 * is not a country (unknown, Tor).
 */
function countryFlag(code: string): string | undefined {
	if (!/^[A-Z]{2}$/.test(code) || code in COUNTRY_FALLBACKS) return undefined;
	return `https://cdn.ipregistry.co/flags/twemoji/${code.toLowerCase()}.svg`;
}

let regionNames: Intl.DisplayNames | null | undefined;

function countryName(code: string): string {
	const fallback = COUNTRY_FALLBACKS[code];
	if (fallback) return fallback;

	if (regionNames === undefined) {
		// Not universally available, and it throws on some older engines.
		try {
			regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
		} catch {
			regionNames = null;
		}
	}

	try {
		return regionNames?.of(code) ?? code;
	} catch {
		return code;
	}
}

function titleCase(value: string): string {
	// Country and subdivision codes are already correct in upper case.
	if (/^[A-Z]{2}(-[A-Z0-9]+)?$/.test(value)) return value;
	return value.charAt(0).toUpperCase() + value.slice(1);
}
