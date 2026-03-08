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
| Country Data | Monthly | Monthly pipeline run |
| Static References | Quarterly | Manual review |

## Handling Source Conflicts

When sources disagree, we apply these rules:

1. **Official sources first** - ISO for country codes, UN for designations
2. **Consensus wins** - If 3+ sources agree, use that value
3. **Document ambiguity** - Flag uncertain data in metadata
4. **Manual review** - Critical conflicts are reviewed by maintainers

## Licensing Compliance

All sources we use have licenses compatible with our CC BY 4.0 distribution:

| Source | License |
|--------|---------|
| GeoNames | CC BY 4.0 |
| ISO Codes | Freely usable |
| UN Data | Open |

## Suggesting New Sources

Know of a high-quality data source we should consider? Open an issue in the relevant repository with:

1. Source name and URL
2. What data it provides
3. How it could improve our datasets
4. Licensing information
