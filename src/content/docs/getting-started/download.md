---
title: Download
description: Download large datasets at full speed using Rclone's multi-threaded transfers.
---

Some OpenPlanetData datasets are hundreds of gigabytes. A standard browser download uses a single HTTP connection, which rarely saturates modern network links.
With a single connection, downloading a 175 GB file can take over an hour, even with a fiber connection.

## Why Rclone?

[Rclone](https://rclone.org/) solves this by splitting the file into many chunks and downloading them in parallel — making full use of your available bandwidth. 

Rclone's multi-threaded mode opens dozens of parallel connections, each fetching a different part of the file simultaneously. This lets you reach speeds that would otherwise be impossible with a single stream.

Here is a real-world example downloading the 175 GB OpenStreetMap GeoParquet dataset over a standard 8 Gbit/s residential ISP connection — this is a remote download, not local:

```sh
$ rclone copy \
    --buffer-size 0 \
    --disable-http2 \
    --http-url https://download2.openplanetdata.com \
    :http:osm/planet/geoparquet/v1/planet-latest.osm.parquet . \
    --multi-thread-cutoff 0 \
    --multi-thread-streams 64 \
    --multi-thread-chunk-size 32M \
    --transfers 1 --progress

Transferred:        5.442 GiB / 174.687 GiB, 3%, 763.213 MiB/s, ETA 3m47s
Transferred:            0 / 1, 0%
Transferred:        6.338 GiB / 174.687 GiB, 4%, 783.920 MiB/s, ETA 3m39s
Transferred:            0 / 1, 0%
Transferred:       12.964 GiB / 174.687 GiB, 7%, 870.083 MiB/s, ETA 3m10s
Transferred:            0 / 1, 0%
Transferred:       14.347 GiB / 174.687 GiB, 8%, 876.515 MiB/s, ETA 3m7s
Transferred:            0 / 1, 0%
Transferred:       15.327 GiB / 174.687 GiB, 9%, 882.108 MiB/s, ETA 3m4s
Transferred:            0 / 1, 0%
Transferred:       78.810 GiB / 174.687 GiB, 45%, 928.088 MiB/s, ETA 1m45s
Transferred:            0 / 1, 0%
Elapsed time:      1m28.2s
Transferring:
 *   planet-latest.osm.parquet: 45% /174.687Gi, 927.625Mi/s, 1m45s
```

The file downloads at approximately **900 MiB/s**, completing the full 175 GB transfer in around **3 minutes**.

## Installation

Rclone is available on all major platforms. See the [official installation guide](https://rclone.org/install/) or use your package manager:

```bash
# macOS
brew install rclone

# Ubuntu / Debian
sudo apt install rclone

# Windows (with winget)
winget install Rclone.Rclone
```

## Usage

Every dataset page on OpenPlanetData includes an **Rclone** button next to the download link. Clicking it shows a ready-to-use command tailored to that specific file.

The general pattern is:

```bash
rclone copy \
    --buffer-size 0 \
    --disable-http2 \
    --http-url https://download2.openplanetdata.com \
    :http:<remote_path>/<version>/<filename> . \
    --multi-thread-cutoff 0 \
    --multi-thread-streams 64 \
    --multi-thread-chunk-size 32M \
    --transfers 1 --progress
```

### Key flags

- **`--multi-thread-streams 64`** — Number of parallel connections. 64 works well for high-bandwidth links. Reduce to 8–16 on slower connections.
- **`--multi-thread-chunk-size 32M`** — Size of each chunk. 32 MB is a good default.
- **`--multi-thread-cutoff 0`** — Always use multi-threading, even for small files.
- **`--disable-http2`** — Forces HTTP/1.1, which allows true parallel TCP connections instead of multiplexing over a single one.
- **`--buffer-size 0`** — Disables in-memory buffering to reduce RAM usage on large files.
- **`--progress`** — Shows real-time transfer statistics.

### Adjusting for your bandwidth

| Link speed | Suggested `--multi-thread-streams` |
|---|---|
| 100 Mbit/s | 4–8 |
| 1 Gbit/s | 16–32 |
| 8+ Gbit/s | 64 |

Higher values use more CPU and memory. If you see diminishing returns or errors, lower the stream count.
