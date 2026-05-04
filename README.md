# OSM boundary checker (Germany)

Compare official administrative boundaries with OpenStreetMap per configured dataset, then explore results in the report web app.

## Prerequisites

- Bun
- Rust toolchain
- `osmium-tool`, GDAL (`ogr2ogr`), `tippecanoe`, `unzip`

## Quick start

From this directory:

```bash
bun install
bun run rust:build
bun run pipeline:nightly
bun run report:dev
```

Open the URL printed by the dev server (default port 3000).

`DATA_ROOT` overrides where `datasets/` and `data/` are read from (defaults to the repo root).

## Common commands

| Goal                                 | Command                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Full data refresh + compare          | `bun run pipeline:nightly` (or `bun run download` then `bun run compare`)    |
| Compare (interactive)                | `bun run compare`                                                            |
| Compare (non-interactive)            | `CI=1 bun run compare -- --area <folder>` or `CI=1 bun run compare -- --all` |
| Sync report static inputs            | `bun run report:sync-runtime-assets`                                         |
| Production build (from runtime tree) | `bun run report:build`                                                       |
| Unit tests                           | `bun run test`                                                               |

## Layout

- `scripts/` — download, extract, compare, orchestration
- `datasets/` — per-area config and generated outputs (`output/`, `snapshots.json`, PMTiles)
- `data/` — processing status used by the UI
- `report/` — Vite + React app

Large generated inputs and outputs are gitignored; see [`datasets/.gitignore`](datasets/.gitignore).

## More documentation

- BKG VG25 download and layers: [`docs/vg25-bkg.md`](docs/vg25-bkg.md)
- Report app details and workspace scripts: [`report/README.md`](report/README.md)
- New dataset: [`.github/ISSUE_TEMPLATE/dataset-request.yml`](.github/ISSUE_TEMPLATE/dataset-request.yml)

## Deploy

Serve the contents of `report/dist` with the copied `datasets/` and `data/` assets on the same origin (or paths the build expects). PMTiles loads via HTTP range requests; the host must return correct `Content-Length` and support `206` / `Content-Range` for ranged reads on `.pmtiles` files.
