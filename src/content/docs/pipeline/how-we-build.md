---
title: How We Build Datasets
description: Understand our transparent data pipeline and methodology.
---

At OpenPlanetData, transparency is a core principle. This page explains exactly how we build, validate, and maintain our datasets so you can trust the data you're using.

## Pipeline Overview

Our data pipeline follows a consistent process across all datasets:

```
┌─────────────┐    ┌──────────────┐    ┌────────────┐    ┌──────────────┐
│   Collect   │ → │   Process    │ → │  Validate  │ → │   Publish    │
│   Sources   │    │   & Clean    │    │  & Test    │    │   Release    │
└─────────────┘    └──────────────┘    └────────────┘    └──────────────┘
```

### 1. Source Collection

We aggregate data from multiple authoritative sources. Each source is:

- **Documented** - We record what source provides what data
- **Versioned** - We track which version of source data we're using
- **Validated** - We verify the source is still authoritative and up-to-date

### 2. Processing & Cleaning

Raw source data goes through several processing steps:

- **Normalization** - Convert data to consistent formats and encodings
- **Deduplication** - Remove duplicate entries
- **Enrichment** - Add derived fields where appropriate
- **Conflict Resolution** - Handle cases where sources disagree

### 3. Validation & Testing

Every dataset update is validated before release:

- **Schema Validation** - Ensure data matches expected structure
- **Completeness Checks** - Verify all expected entries are present
- **Accuracy Sampling** - Test random samples against known ground truth
- **Regression Testing** - Compare with previous versions for unexpected changes

### 4. Publishing

Validated datasets are published as releases:

- **Multiple Formats** - JSON, CSV, Parquet as appropriate
- **Versioned Releases** - Semantic versioning for tracking changes
- **Checksums** - SHA256 hashes for integrity verification
- **Changelogs** - Document what changed in each release

## Conflict Resolution

When different sources provide conflicting information, we follow a documented resolution process:

1. **Source Priority** - Some sources are considered more authoritative for specific data types
2. **Recency** - More recent data typically takes precedence
3. **Consensus** - When multiple sources agree, that value is preferred
4. **Manual Review** - Edge cases are flagged for human review

All conflict resolutions are logged and can be reviewed in our source repositories.

## Automation

Our pipelines are fully automated using GitHub Actions:

- **Scheduled Runs** - Pipelines run on fixed schedules (weekly/monthly)
- **Source Monitoring** - We detect when sources update
- **Automatic PRs** - Updates create pull requests for review
- **CI/CD** - All validation tests run automatically

## Open Source

All our pipeline code is open source:

- **Pipeline Code** - See exactly how data is processed
- **Validation Tests** - Review our testing methodology
- **Source Configurations** - Know which sources we use

Visit our [GitHub organization](https://github.com/openplanetdata) to explore the code.

## Reproducibility

Anyone can reproduce our datasets by:

1. Cloning the repository
2. Running the pipeline scripts
3. Verifying the output matches our releases

This ensures our data can be independently verified and audited.

## Contributing

We welcome contributions to improve our pipelines:

- **Bug Reports** - Found an issue? Open a GitHub issue
- **Data Corrections** - Know of an error? Submit a PR with evidence
- **Source Suggestions** - Know of a better source? Let us know
- **Code Improvements** - Help us improve our processing logic

See our contribution guidelines in each repository for details.
