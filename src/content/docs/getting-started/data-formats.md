---
title: Data Formats
description: Learn about the data formats supported by OpenPlanetData and when to use each one.
---

OpenPlanetData outputs datasets in three main geospatial formats wherever possible: **GeoJSON**, **GeoPackage**, and **GeoParquet**. When a dataset has domain-specific needs, specialized formats are used instead — for example, OpenStreetMap snapshots are distributed in PBF, GOB, and GOL formats designed for OSM tooling.

## At a Glance

| Format | File Size | Query Speed | Best For |
|---|---|---|---|
| GeoJSON | Large | Slow | Web apps, APIs, quick inspection |
| GeoPackage | Medium | Medium | Desktop GIS, offline use |
| GeoParquet | Small | Fast | Analytics, cloud-native workflows |

## GeoJSON

[GeoJSON](https://geojson.org/) is a text-based format that encodes geographic features using JSON. It is human-readable, universally supported, and easy to integrate into web applications.

Use GeoJSON when you need to:
- Display data on a web map (Leaflet, Mapbox, OpenLayers)
- Serve geospatial data through a REST API
- Quickly inspect or debug geometries in a text editor
- Work with small to medium datasets where file size is not a concern

:::caution
GeoJSON files can be significantly larger than their binary equivalents. For large datasets such as planet boundaries, we suggest using GeoParquet or GeoPackage instead, even if GeoJSON is available.
:::

## GeoPackage

[GeoPackage](https://www.geopackage.org/) is an open standard built on SQLite. It packages vector features, attributes, and metadata into a single portable file that can be queried with SQL.

Use GeoPackage when you need to:
- Load data into desktop GIS applications like QGIS or ArcGIS
- Work offline with a self-contained database
- Store and query multiple layers in a single file
- Share data with users who rely on traditional GIS tools

## GeoParquet

[GeoParquet](https://geoparquet.org/) is a columnar storage format based on Apache Parquet, designed for efficient geospatial analytics. It provides excellent compression, fast queries, and native support in modern data tools.

Use GeoParquet when you need to:
- Run analytical queries on large datasets with tools like DuckDB, Apache Spark, or pandas/GeoPandas
- Minimize storage and bandwidth costs
- Work in cloud-native environments where columnar formats shine
- Process data in batch pipelines
