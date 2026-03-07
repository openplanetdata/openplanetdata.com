---
title: Time Zone
description: Daily time zone boundary data in GeoParquet format for fast spatial queries.
---

OpenPlanetData provides daily snapshots of global time zone boundaries in GeoParquet format.

## Overview

Our time zone snapshots are generated from the latest [timezone-boundary-builder](https://github.com/evansiroky/timezone-boundary-builder) releases and converted to GeoParquet format for efficient storage and fast spatial queries.

## Source Data

The snapshots are based on `timezones-with-oceans.geojson.zip` from timezone-boundary-builder, which includes:

- All land-based time zones
- Ocean time zones for complete global coverage

## GeoParquet Format

We convert the source GeoJSON to [GeoParquet](https://geoparquet.org/) format, which offers:

- **Columnar storage** - Efficient compression and fast column-based queries
- **Spatial indexing** - Optimized for geographic queries
- **Wide compatibility** - Supported by many GIS tools and libraries

### Reading GeoParquet

You can read GeoParquet files with popular libraries:

```python
import geopandas as gpd

# Read the time zone data
timezones = gpd.read_parquet("timezones.parquet")
```

```javascript
import { readParquet } from 'parquet-wasm';

const data = await readParquet(buffer);
```

## Update Frequency

Snapshots are updated daily to incorporate any changes from the upstream timezone-boundary-builder project.

## Hosting

All snapshots are hosted on Cloudflare R2, optimized for fast global access.
