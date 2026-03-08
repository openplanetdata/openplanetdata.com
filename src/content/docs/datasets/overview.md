---
title: Datasets Overview
description: Explore all available OpenPlanetData datasets.
---

OpenPlanetData provides regular snapshots of geographic datasets in optimized formats, most updated daily. All data is hosted on Cloudflare R2 for fast global access.

## Available Datasets

<div class="dataset-grid">
  <a href="/datasets/boundaries/" class="dataset-card">
    <div class="dataset-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
        <line x1="9" y1="3" x2="9" y2="18"/>
        <line x1="15" y1="6" x2="15" y2="21"/>
      </svg>
    </div>
    <h3>Boundaries</h3>
    <p>Continents, countries, and regions boundaries in GeoJSON, GeoPackage, and GeoParquet formats.</p>
  </a>
  <a href="/datasets/openstreetmap-snapshots/" class="dataset-card">
    <div class="dataset-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
        <path d="M2 12h20"/>
      </svg>
    </div>
    <h3>OpenStreetMap</h3>
    <p>Daily snapshots of OpenStreetMap data in PBF, GOB, and GOL formats with global coverage.</p>
  </a>
  <a href="/datasets/timezone-snapshots/" class="dataset-card">
    <div class="dataset-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    </div>
    <h3>Time Zone</h3>
    <p>Global time zone boundary data in GeoParquet format with complete coverage including oceans.</p>
  </a>
</div>

<style>
  .dataset-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin: 1.5rem 0;
  }

  @media (max-width: 640px) {
    .dataset-grid {
      grid-template-columns: 1fr;
    }
  }

  .dataset-card {
    display: block;
    padding: 1.25rem 1.5rem;
    background-color: var(--sl-color-black);
    border: 1px solid var(--sl-color-gray-5);
    border-radius: 1rem;
    text-decoration: none !important;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }

  .dataset-card:hover {
    border-color: var(--sl-color-gray-3);
    background-color: var(--sl-color-gray-6);
  }

  .dataset-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    margin-bottom: 1rem;
    color: var(--sl-color-accent);
  }

  .dataset-icon svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  .dataset-card h3 {
    margin: 0 0 0.5rem 0 !important;
    padding: 0 !important;
    font-size: 1rem !important;
    font-weight: 600;
    color: var(--sl-color-white);
    border: none !important;
  }

  .dataset-card p {
    margin: 0 !important;
    font-size: 0.875rem;
    color: var(--sl-color-gray-2);
    line-height: 1.5;
  }
</style>
