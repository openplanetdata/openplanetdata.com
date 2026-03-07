---
title: Quick Start
description: Get up and running with OpenPlanetData in minutes.
---

This guide will help you quickly access and use OpenPlanetData datasets in your projects.

## Accessing Datasets

All OpenPlanetData datasets are freely available and can be accessed in multiple ways:

### Direct Download

Download datasets directly from our releases:

```bash
# Download the latest IP geolocation dataset
curl -LO https://github.com/openplanetdata/ip-geolocation/releases/latest/download/ip-geolocation.json

# Download country data
curl -LO https://github.com/openplanetdata/country-data/releases/latest/download/countries.json
```

### Using npm/yarn

For Node.js projects, you can install datasets as packages:

```bash
npm install @openplanetdata/countries
```

```javascript
import { countries } from '@openplanetdata/countries';

// Get country by ISO code
const france = countries.find(c => c.alpha2 === 'FR');
console.log(france.name); // "France"
```

### Using in Python

```bash
pip install openplanetdata
```

```python
from openplanetdata import countries

# Get all countries
all_countries = countries.get_all()

# Find by code
france = countries.get_by_alpha2('FR')
print(france['name'])  # "France"
```

## Dataset Formats

Each dataset is available in multiple formats. Choose the one that best fits your use case:

| Format | Best For | File Extension |
|--------|----------|----------------|
| JSON | Web applications, APIs | `.json` |
| CSV | Spreadsheets, data analysis | `.csv` |
| Parquet | Big data, analytics pipelines | `.parquet` |

## Example: IP Geolocation Lookup

Here's a quick example of how to use the IP geolocation dataset:

```javascript
import ipData from './ip-geolocation.json';

function lookupIP(ip) {
  // Convert IP to numeric format for range lookup
  const numericIP = ipToNumber(ip);

  // Binary search through ranges
  const result = ipData.find(range =>
    numericIP >= range.start && numericIP <= range.end
  );

  return result ? {
    country: result.country,
    region: result.region,
    city: result.city
  } : null;
}

const location = lookupIP('8.8.8.8');
console.log(location);
// { country: 'US', region: 'California', city: 'Mountain View' }
```

## Next Steps

- [Explore all datasets](/datasets/overview/) - See what's available
- [Understand the data pipeline](/pipeline/how-we-build/) - Learn how datasets are built
- [View data sources](/pipeline/data-sources/) - See where our data comes from
