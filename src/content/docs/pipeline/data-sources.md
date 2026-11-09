---
title: Data Sources
description: The upstream sources our datasets are built from, how often we refresh them, and their licenses.
---

Transparency about data sources is fundamental to OpenPlanetData. This page lists the upstream sources every published dataset is built from, how often we pull them, and the license the resulting data is distributed under.

## OpenStreetMap

[OpenStreetMap](https://www.openstreetmap.org) is a collaborative map of the world built by a community of volunteers. It is the source of almost everything we publish.

**How we fetch it:** every day we download the latest weekly [planet dump](https://planet.openstreetmap.org/) and bring it up to date with the official hourly [replication diffs](https://planet.openstreetmap.org/replication/hour/). Each release therefore reflects OpenStreetMap as of the most recent hourly diff available when the pipeline runs.

**What we build from it:**

- **[OpenStreetMap planet](/datasets/openstreetmap/planet/)** — the planet itself, in PBF, GOL, GOB, and GeoParquet.
- **Coastline** — land and water polygons extracted from OpenStreetMap coastline ways with [osmcoastline](https://osmcode.org/osmcoastline/).
- **[Boundaries](/datasets/boundaries/)** — continent, country, and region polygons built from OpenStreetMap administrative boundaries, clipped to the coastline.

## timezone-boundary-builder

[timezone-boundary-builder](https://github.com/evansiroky/timezone-boundary-builder) builds time zone boundary polygons from OpenStreetMap data. We use the `timezones-with-oceans` file of its latest release and convert it for the **[Time Zones](/datasets/time-zones/)** dataset.

## Refresh Schedule

| Dataset | Source | Refresh |
|---------|--------|---------|
| OpenStreetMap planet | OpenStreetMap planet dump + hourly diffs | Daily, starting at 01:00 UTC |
| Coastline | OpenStreetMap planet | Weekly, Mondays at 02:00 UTC |
| Boundaries | OpenStreetMap planet + coastline | Weekly, after each coastline build |
| Time Zones | timezone-boundary-builder latest release | Daily check at 01:00 UTC |

## Licensing

Every dataset listed above is derived from OpenStreetMap data, including the time zones, which timezone-boundary-builder builds from OpenStreetMap.

| Source | License |
|--------|---------|
| OpenStreetMap | [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/) |
| timezone-boundary-builder | [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/) |

These datasets are &copy; [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) and are made available under the ODbL. When you use or redistribute them, credit **&copy; OpenStreetMap contributors**, make clear the data is available under the ODbL, and share any adapted database you publish under the ODbL as well. The [Terms of Use](/terms/) and the [OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) give the details.

## Suggesting New Sources

Know of a high-quality data source we should consider? Open an issue in the relevant repository with:

1. Source name and URL
2. What data it provides
3. How it could improve our datasets
4. Licensing information
