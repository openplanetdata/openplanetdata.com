import { LitElement, html, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

interface FileEntry {
  id: string;
  name: string | null;
  entity: string;
  extension: string;
  size: number;
  remote_path: string;
  remote_filename: string;
  remote_version: string;
  checksum_sha256: string;
  updated: number;
  deprecated: boolean;
  deprecation_reason: string | null;
}

type EntityFormats = Record<string, FileEntry>;

interface ResolvedEntity {
  slug: string;
  name: string;
  nameLower: string;
  allDeprecated: boolean;
  formats: EntityFormats;
}

const FORMAT_LABELS: Record<string, string> = {
  geojson: 'GeoJSON',
  gpkg: 'GeoPackage',
  parquet: 'GeoParquet',
};

const ROW_HEIGHT = 64;
const VISIBLE_ROWS = 12;
const BUFFER_ROWS = 5;
const CONTAINER_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

@customElement('dataset-files')
export class DatasetFilesElement extends LitElement {
  @property({ attribute: 'api-url' }) accessor apiUrl = '';
  @property({ attribute: 'base-download-url' }) accessor baseDownloadUrl = '';
  @property({ type: Boolean, attribute: 'show-all-formats' }) accessor showAllFormats = false;
  @property({ type: Boolean, attribute: 'show-version' }) accessor showVersion = false;

  @state() accessor _loading = true;
  @state() accessor _error = false;
  @state() accessor _errorMessage = 'Failed to load files. Please try again later.';
  @state() accessor _selectedFormat = '';
  @state() accessor _availableFormats: string[] = [];
  @state() accessor _searchQuery = '';
  @state() accessor _rcloneDialogFile: FileEntry | null = null;
  @state() accessor _copiedHash: string | null = null;
  @state() accessor _copiedCommand = false;
  private _sortedEntities: ResolvedEntity[] = [];
  private _cachedFilterQuery: string | null = null;
  private _cachedFiltered: ResolvedEntity[] = [];
  private _debounceTimer = 0;
  private _scrollRaf = 0;
  private _scrollTop = 0;

  createRenderRoot() { return this; }

  connectedCallback() {
    super.connectedCallback();
    this.fetchData();
  }

  // --- Data Fetching ---

  private async fetchData() {
    try {
      const res = await fetch(this.apiUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const files: FileEntry[] = data.files;

      if (!files || files.length === 0) {
        this._errorMessage = 'No files available yet.';
        this._error = true;
        this._loading = false;
        return;
      }

      // Group files by entity, keyed by extension
      const entityMap = new Map<string, EntityFormats>();
      const formatSet = new Set<string>();
      for (const file of files) {
        const slug = file.entity;
        if (!entityMap.has(slug)) entityMap.set(slug, {});
        entityMap.get(slug)![file.extension] = file;
        formatSet.add(file.extension);
      }

      this._availableFormats = Array.from(formatSet).sort((a, b) =>
        this.formatLabel(a).localeCompare(this.formatLabel(b))
      );
      this._selectedFormat = this._availableFormats[0] || 'geojson';

      this._sortedEntities = Array.from(entityMap.entries())
        .map(([slug, formats]) => {
          const name = this.resolveEntityName(formats, slug);
          const allDeprecated = Object.values(formats).every(f => f.deprecated);
          return { slug, name, nameLower: name.toLowerCase(), formats, allDeprecated };
        })
        .sort((a, b) => {
          if (a.allDeprecated !== b.allDeprecated) return a.allDeprecated ? 1 : -1;
          return a.name.localeCompare(b.name);
        });

      this._loading = false;
    } catch {
      this._error = true;
      this._loading = false;
    }
  }

  // --- Helpers ---

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  private formatLabel(ext: string): string {
    return FORMAT_LABELS[ext] || ext.toUpperCase();
  }

  private formatDate(timestamp: number): string {
    const d = new Date(timestamp);
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
    }) + ' ' + d.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
    }) + ' UTC';
  }

  private downloadUrl(file: FileEntry): string {
    return `${this.baseDownloadUrl}/${file.id}`;
  }

  private resolveEntityName(formats: EntityFormats, slug: string): string {
    for (const f of Object.values(formats)) {
      if (f.name) return f.name;
    }
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  private rcloneCommand(file: FileEntry): string {
    const url = this.downloadUrl(file);
    return `rclone copy \\\n    --buffer-size 0 \\\n    --disable-http2 \\\n    --http-url ${url} \\\n    :http: . \\\n    --multi-thread-cutoff 0 \\\n    --multi-thread-streams 64 \\\n    --multi-thread-chunk-size 32M \\\n    --transfers 1 --progress`;
  }

  private get fileCount(): number {
    const fmt = this._selectedFormat;
    let count = 0;
    for (const e of this._sortedEntities) {
      if (e.formats[fmt]) count++;
    }
    return count;
  }

  private get filteredEntries(): ResolvedEntity[] {
    const q = this._searchQuery;
    if (q === this._cachedFilterQuery) return this._cachedFiltered;
    this._cachedFilterQuery = q;
    if (!q) {
      this._cachedFiltered = this._sortedEntities;
    } else {
      const lower = q.toLowerCase();
      this._cachedFiltered = this._sortedEntities.filter(e =>
        e.nameLower.includes(lower)
      );
    }
    return this._cachedFiltered;
  }

  private get isLarge(): boolean {
    return this._sortedEntities.length > 15;
  }

  // --- Event Handlers ---

  private onFormatSelect(ext: string) {
    this._selectedFormat = ext;
  }

  private onSearchInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = window.setTimeout(() => {
      this._scrollTop = 0;
      const container = this.querySelector('.table-body') as HTMLElement | null;
      if (container) container.scrollTop = 0;
      this._searchQuery = value;
    }, 150);
  }

  private onScroll(e: Event) {
    const scrollTop = (e.target as HTMLElement).scrollTop;
    if (this._scrollRaf) cancelAnimationFrame(this._scrollRaf);
    this._scrollRaf = requestAnimationFrame(() => {
      this._scrollTop = scrollTop;
      this.requestUpdate();
    });
  }

  private onOpenRclone(file: FileEntry) {
    this._rcloneDialogFile = file;
    this._copiedCommand = false;
  }

  private onCloseRclone() {
    this._rcloneDialogFile = null;
  }

  private onBackdropClick(e: Event) {
    if (e.target === e.currentTarget) this.onCloseRclone();
  }

  private async onCopyCommand() {
    if (!this._rcloneDialogFile) return;
    const cmd = this.rcloneCommand(this._rcloneDialogFile).replace(/\\\n\s*/g, ' ');
    await navigator.clipboard.writeText(cmd);
    this._copiedCommand = true;
    setTimeout(() => { this._copiedCommand = false; }, 1500);
  }

  private async onCopyHash(sha256: string) {
    await navigator.clipboard.writeText(sha256);
    this._copiedHash = sha256;
    setTimeout(() => { this._copiedHash = null; }, 1500);
  }

  // --- Templates ---

  private downloadIcon() {
    return svg`
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;
  }

  private renderToolbar() {
    return html`
      <div class="dataset-toolbar">
        <div class="format-picker">
          ${this._availableFormats.map(ext => html`
            <button
              class="format-picker-btn ${ext === this._selectedFormat ? 'active' : ''}"
              @click=${() => this.onFormatSelect(ext)}
            >${this.formatLabel(ext)}</button>
          `)}
        </div>
        ${this.isLarge ? html`
          <input
            type="text"
            placeholder="Filter..."
            class="search-input"
            @input=${this.onSearchInput}
          />
        ` : nothing}
      </div>
    `;
  }

  private renderSummary(filtered: number) {
    const total = this.fileCount;
    const text = filtered < total
      ? `${filtered} of ${total} files`
      : `${total} file${total !== 1 ? 's' : ''} available`;
    return html`
      <div class="dataset-summary">${text}</div>
    `;
  }

  private renderDeprecationNotice(file: FileEntry) {
    if (!file.deprecated) return nothing;
    return html`
      <div class="deprecation-notice">
        <span class="deprecation-badge">Deprecated</span>
        ${file.deprecation_reason
          ? html`<span class="deprecation-reason">${file.deprecation_reason}</span>`
          : nothing}
      </div>
    `;
  }

  private renderFormatDetail(file: FileEntry) {
    const sha256 = file.checksum_sha256;
    const isCopied = this._copiedHash === sha256;

    return html`
      <div class="entity-detail">
        ${this.renderDeprecationNotice(file)}
        <div class="entity-info">
          <div class="info-row">
            <span class="info-label">Size</span>
            <span class="info-value">${this.formatSize(file.size)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">SHA-256</span>
            <code class="info-hash" title="Click to copy full hash"
              @click=${() => this.onCopyHash(sha256)}
            >${isCopied ? 'Copied!' : sha256.slice(0, 8) + '...' + sha256.slice(-8)}</code>
          </div>
          <div class="info-row">
            <span class="info-label">Updated</span>
            <span class="info-value">${this.formatDate(file.updated)}</span>
          </div>
          ${this.showVersion ? html`
            <div class="info-row">
              <span class="info-label">Version</span>
              <span class="info-value">${file.remote_version}</span>
            </div>
          ` : nothing}
        </div>
        <div class="entity-actions">
          <button class="action-btn action-rclone" title="Download with Rclone"
            @click=${() => this.onOpenRclone(file)}>Rclone</button>
          <a href=${this.downloadUrl(file)} class="action-btn action-download">
            ${this.downloadIcon()}<span>Download</span>
          </a>
        </div>
      </div>
    `;
  }

  private renderCards() {
    const fmt = this._selectedFormat;
    const entries = this._sortedEntities
      .filter(e => e.formats[fmt])
      .sort((a, b) => {
        const da = a.formats[fmt].deprecated ? 1 : 0;
        const db = b.formats[fmt].deprecated ? 1 : 0;
        return da - db || a.name.localeCompare(b.name);
      });
    return html`
      ${this.renderToolbar()}
      <div class="entity-grid">
        ${entries.map(e => {
          const file = e.formats[fmt]!;
          return html`
            <div class="entity-card ${file.deprecated ? 'deprecated' : ''}">
              <div class="entity-name">${e.name}</div>
              ${this.renderFormatDetail(file)}
            </div>
          `;
        })}
      </div>
      ${this.renderSummary(entries.length)}
    `;
  }

  private renderAllFormatsCards() {
    const items = this._sortedEntities.flatMap(e =>
      Object.entries(e.formats).map(([ext, file]) => ({ entity: e, ext, file }))
    );
    items.sort((a, b) => {
      if (a.file.deprecated !== b.file.deprecated) return a.file.deprecated ? 1 : -1;
      return a.entity.name.localeCompare(b.entity.name);
    });
    return html`
      <div class="entity-grid">
        ${items.map(({ entity, ext, file }) => html`
          <div class="entity-card ${file.deprecated ? 'deprecated' : ''}">
            <div class="entity-header">
              <div class="entity-name">${entity.name}</div>
              <div class="entity-format-badge">${this.formatLabel(ext)}</div>
            </div>
            ${this.renderFormatDetail(file)}
          </div>
        `)}
      </div>
      <div class="dataset-summary">${items.length} file${items.length !== 1 ? 's' : ''} available</div>
    `;
  }

  private renderTableRow(entity: ResolvedEntity) {
    const file = entity.formats[this._selectedFormat];
    if (!file) return nothing;
    return html`
      <div class="table-row ${file.deprecated ? 'deprecated' : ''}" style="height:${ROW_HEIGHT}px;box-sizing:border-box">
        <div class="table-row-left">
          <div class="table-cell table-cell-name">
            ${entity.name}
            ${file.deprecated ? html`<span class="deprecation-badge-inline">Deprecated</span>` : nothing}
          </div>
          <div class="table-cell table-cell-updated">
            ${this.formatDate(file.updated)}
          </div>
        </div>
        <div class="table-row-right">
          <div class="table-detail">
            <div class="table-cell table-cell-size">${this.formatSize(file.size)}</div>
            <button class="action-btn action-rclone compact" title="Download with Rclone"
              @click=${() => this.onOpenRclone(file)}>Rclone</button>
            <a href=${this.downloadUrl(file)} class="action-btn action-download compact">
              ${this.downloadIcon()}<span>Download</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private renderTable() {
    const filtered = this.filteredEntries;
    const totalHeight = filtered.length * ROW_HEIGHT;
    const startIdx = Math.max(0, Math.floor(this._scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
    const endIdx = Math.min(filtered.length, startIdx + VISIBLE_ROWS + BUFFER_ROWS * 2);
    const offsetY = startIdx * ROW_HEIGHT;
    const visible = filtered.slice(startIdx, endIdx);

    return html`
      ${this.renderToolbar()}
      <div class="table-body" style="height:${CONTAINER_HEIGHT}px;overflow-y:auto" @scroll=${this.onScroll}>
        <div style="height:${totalHeight}px;position:relative">
          <div style="position:absolute;top:${offsetY}px;left:0;right:0">
            ${visible.map(e => this.renderTableRow(e))}
          </div>
        </div>
      </div>
      ${filtered.length === 0 ? html`
        <div class="no-results">No matching files found.</div>
      ` : nothing}
      ${this.renderSummary(filtered.length)}
    `;
  }

  private renderRcloneDialog() {
    if (!this._rcloneDialogFile) return nothing;
    const cmd = this.rcloneCommand(this._rcloneDialogFile);

    return html`
      <div class="rclone-backdrop" @click=${this.onBackdropClick}>
        <div class="rclone-dialog">
          <h3 class="rclone-title">Download with Rclone</h3>
          <p class="rclone-desc">
            Use this Rclone command to download multiple chunks in parallel. Adjust
            <code>--multi-thread-streams</code>
            to match your bandwidth (the settings below maxes out an 8 Gbit/s link).
          </p>
          <pre class="rclone-code"><code>${cmd}</code></pre>
          <div class="rclone-footer">
            <button class="rclone-btn rclone-btn-close" @click=${this.onCloseRclone}>Close</button>
            <button class="rclone-btn rclone-btn-copy" @click=${this.onCopyCommand}>
              ${this._copiedCommand ? 'Copied!' : 'Copy Command'}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (this._loading) {
      return html`
        <div class="dataset-loading">
          <div class="spinner"></div>
          <p>Loading files...</p>
        </div>
      `;
    }

    if (this._error) {
      return html`
        <div class="dataset-error">
          <p>${this._errorMessage}</p>
        </div>
      `;
    }

    return html`
      ${this.showAllFormats
        ? this.renderAllFormatsCards()
        : this.isLarge ? this.renderTable() : this.renderCards()}
      ${this.renderRcloneDialog()}
    `;
  }
}
