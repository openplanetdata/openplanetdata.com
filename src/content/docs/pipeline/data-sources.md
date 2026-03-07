---
title: Data Sources
description: The authoritative sources we use to build our datasets.
---

Transparency about data sources is fundamental to OpenPlanetData. This page documents all the sources we use, what data they provide, and how we evaluate their reliability.

## Source Selection Criteria

We evaluate potential data sources based on:

| Criterion | Description |
|-----------|-------------|
| **Authority** | Is the source the official or authoritative provider of this data? |
| **Accuracy** | How accurate is the data based on independent verification? |
| **Currency** | How frequently is the source updated? |
| **Accessibility** | Is the data freely accessible and machine-readable? |
| **Licensing** | Does the license allow redistribution? |

## IP Geolocation Sources

### Regional Internet Registries (RIRs)

The five RIRs are the authoritative source for IP address allocation:

| RIR | Region | Data Provided |
|-----|--------|---------------|
| [ARIN](https://www.arin.net) | North America | IP allocations, ASN data |
| [RIPE NCC](https://www.ripe.net) | Europe, Middle East, Central Asia | IP allocations, ASN data |
| [APNIC](https://www.apnic.net) | Asia Pacific | IP allocations, ASN data |
| [LACNIC](https://www.lacnic.net) | Latin America, Caribbean | IP allocations, ASN data |
| [AFRINIC](https://www.afrinic.net) | Africa | IP allocations, ASN data |

**What we use:** IP range allocations, country assignments, ASN information

### BGP Routing Data

Routing data helps us understand the actual geographic distribution of IP addresses:

- **RouteViews** - University of Oregon project collecting BGP data
- **RIPE RIS** - RIPE Routing Information Service

**What we use:** Active route announcements, origin ASN data

### Geolocation Databases

We cross-reference with multiple geolocation databases:

- **MaxMind GeoLite2** - Free geolocation database (CC BY-SA 4.0)
- **DB-IP Lite** - Free IP geolocation database

**What we use:** City-level geolocation, timezone data

## Country Data Sources

### ISO 3166 Maintenance Agency

The official source for country codes:

- **ISO 3166-1** - Country codes (alpha-2, alpha-3, numeric)
- **ISO 3166-2** - Subdivision codes

**What we use:** Official country codes, country names

### United Nations

Official international organization data:

- **UN Statistics Division** - Country and area codes
- **UN Member States** - Membership information

**What we use:** Country status, UN membership, official names

### GeoNames

Open geographic database with extensive location data:

- **Countries** - Country information and boundaries
- **Administrative Divisions** - Regions, states, provinces

**What we use:** Geographic coordinates, population data, alternate names

### Other Sources

| Source | Data Provided |
|--------|---------------|
| [Rest Countries](https://restcountries.com) | Supplementary country data |
| [World Bank](https://data.worldbank.org) | Population, economic data |
| [CIA World Factbook](https://www.cia.gov/the-world-factbook/) | General country information |

## Source Freshness

We monitor source updates and refresh our data accordingly:

| Source Type | Check Frequency | Update Trigger |
|-------------|-----------------|----------------|
| RIR Databases | Daily | Immediate |
| Geolocation DBs | Weekly | Weekly pipeline run |
| Country Data | Monthly | Monthly pipeline run |
| Static References | Quarterly | Manual review |

## Handling Source Conflicts

When sources disagree, we apply these rules:

1. **Official sources first** - RIRs for IP data, ISO for country codes
2. **Consensus wins** - If 3+ sources agree, use that value
3. **Document ambiguity** - Flag uncertain data in metadata
4. **Manual review** - Critical conflicts are reviewed by maintainers

## Licensing Compliance

All sources we use have licenses compatible with our CC BY 4.0 distribution:

| Source | License |
|--------|---------|
| RIR Data | Open/Public Domain |
| MaxMind GeoLite2 | CC BY-SA 4.0 |
| GeoNames | CC BY 4.0 |
| ISO Codes | Freely usable |
| UN Data | Open |

## Suggesting New Sources

Know of a high-quality data source we should consider? Open an issue in the relevant repository with:

1. Source name and URL
2. What data it provides
3. How it could improve our datasets
4. Licensing information
