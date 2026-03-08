---
title: Quality Assurance
description: How we ensure dataset accuracy and reliability.
---

Quality is not optional at OpenPlanetData. Every dataset goes through rigorous validation before release. This page documents our QA processes and how we measure data quality.

## Quality Principles

1. **Accuracy over speed** - We don't rush releases at the expense of quality
2. **Measurable quality** - We define and track quality metrics
3. **Automated testing** - Most checks run automatically in CI
4. **Human oversight** - Critical changes require manual review
5. **Continuous improvement** - We learn from errors and improve processes

## Validation Pipeline

Every dataset update goes through these validation stages:

### Stage 1: Schema Validation

Ensures data structure is correct:

```yaml
# Example schema check
- All required fields are present
- Field types are correct (string, number, etc.)
- Field values match expected patterns (ISO codes, etc.)
- No unexpected/extra fields
```

### Stage 2: Completeness Checks

Verifies data coverage:

- All expected entries are present (e.g., all 249 countries)
- Required related data is linked correctly

### Stage 3: Consistency Checks

Ensures internal consistency:

- Cross-references validate (country codes match between datasets)
- Derived fields calculate correctly
- No duplicate entries

### Stage 4: Accuracy Sampling

Tests against known ground truth:

```python
# Example accuracy test
known_countries = {
    "FR": {"name": "France", "capital": "Paris"},
    "JP": {"name": "Japan", "capital": "Tokyo"},
    # ... more test cases
}

for code, expected in known_countries.items():
    result = lookup(code)
    assert result.name == expected["name"]
    assert result.capital == expected["capital"]
```

### Stage 5: Regression Testing

Compares with previous versions:

- Detects unexpected changes in stable data
- Flags large changes for review
- Tracks accuracy metrics over time

## Quality Metrics

We track and publish quality metrics for each dataset:

### Country Data

| Metric | Target | Current |
|--------|--------|---------|
| Completeness | 100% | 100% |
| Code Accuracy | 100% | 100% |
| Name Accuracy | > 99% | 99.6% |
| Coordinate Accuracy | > 95% | 97.8% |

## Ground Truth Testing

We maintain test datasets for accuracy validation:

### Country Test Dataset

All 249 countries/territories with verified:
- Official codes from ISO
- Names from UN
- Capitals from official sources

## Error Handling

When issues are detected:

1. **Automated alerts** - CI fails and notifies maintainers
2. **Issue creation** - Tracking issue created automatically
3. **Root cause analysis** - Investigate source of error
4. **Fix and verify** - Correct the issue and add test case
5. **Post-mortem** - Document lessons learned

## Reporting Quality Issues

Found an error in our data? Help us improve:

### For Quick Fixes

Open an issue with:
- Dataset and version affected
- Specific incorrect data
- Correct value with source/evidence

### For Systematic Issues

Open an issue with:
- Description of the pattern
- Examples of affected data
- Suggested fix or investigation approach

## Quality Changelog

We maintain a public changelog of quality improvements:

```
2024-01 - Improved city-level accuracy by 3% via new source
2024-02 - Fixed timezone data for 12 edge-case regions
2024-03 - Added validation for boundary dataset consistency
```

See the CHANGELOG.md in each repository for full history.

## Continuous Improvement

We're always working to improve data quality:

- **Monthly reviews** - Analyze error reports and metrics
- **Source evaluation** - Assess new potential sources
- **Test expansion** - Add new test cases from error reports
- **Process refinement** - Improve pipeline based on lessons learned
