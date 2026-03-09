---
title: OpenStreetMap
description: Daily snapshots of OpenStreetMap data in multiple formats including GOB and GOL files.
---

OpenPlanetData provides daily snapshots of OpenStreetMap data in multiple formats, optimized for different use cases.

## Overview

Our OpenStreetMap snapshots are updated daily and available in several formats:

- **PBF** - Standard OpenStreetMap binary format
- **GOB** - PBF variant indexed with GeoDesk for rapid spatial queries
- **GOL** - PBF variant indexed with GeoDesk for rapid spatial queries

## GeoDesk Indexed Files

GOB and GOL files are PBF variants that have been indexed using [GeoDesk](https://www.geodesk.com/), enabling rapid spatial queries without the need for a full database import.

### Benefits

- **Fast spatial queries** - Query by bounding box, polygon, or other geometries
- **No database required** - Work directly with the file
- **Compact size** - Efficient storage format

## Licensing

- OpenStreetMap data is licensed under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/)
- Generated GOL files are distributed under the same ODbL terms
- Snapshot generation code is released under the MIT License

## Hosting

All snapshots are hosted on Cloudflare R2, a storage service optimized for fast global access to large datasets.

## Verification

Each snapshot includes:
- SHA256 checksums for file integrity verification
- File creation timestamps
