---
title: Data Format Reference
description: Reference documentation for OpenPlanetData data formats.
---

This section contains detailed reference documentation for OpenPlanetData datasets formats.

## Data Format Reference

### JSON Format

All JSON datasets follow consistent formatting:

```json
{
  "version": "1.0.0",
  "generated_at": "2024-01-15T00:00:00Z",
  "license": "CC-BY-4.0",
  "data": [
    // Array of records
  ]
}
```

### CSV Format

CSV files include a header row with field names matching the JSON field names.

```csv
alpha2,alpha3,name,capital,region
US,USA,United States,Washington D.C.,Americas
FR,FRA,France,Paris,Europe
```

### Parquet Format

Parquet files use the same schema as JSON with appropriate type mappings:

| JSON Type | Parquet Type |
|-----------|--------------|
| string | UTF8 |
| number (int) | INT64 |
| number (float) | DOUBLE |
| boolean | BOOLEAN |
| array | LIST |
| object | STRUCT |

## Version Numbering

Datasets follow semantic versioning:

- **MAJOR** - Breaking changes to schema or data format
- **MINOR** - New fields or data additions
- **PATCH** - Bug fixes and corrections

## Checksums

All releases include SHA256 checksums:

```bash
# Verify download integrity
sha256sum -c checksums.txt
```

## Rate Limits

When accessing releases via GitHub:

- Unauthenticated: 60 requests/hour
- Authenticated: 5000 requests/hour

For high-volume access, download datasets and host locally.
