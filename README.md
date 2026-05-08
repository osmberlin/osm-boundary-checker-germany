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
bun run scripts/pipeline/nightly.ts -- --phase all
cd report && bun run dev
```

Open the URL printed by the dev server (default port 3000).

`DATA_ROOT` overrides where `datasets/` and `data/` are read from (defaults to the repo root).

## Common commands

| Goal                                 | Command                                                                                                                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full data refresh + compare          | `bun run scripts/pipeline/nightly.ts -- --phase all` (or CLIs: `download` → `extract` → `compare -- --yes`). Skip PBF re-download: `OSM_SKIP_PBF_DOWNLOAD=1 bun run scripts/pipeline/nightly.ts -- --phase all` |
| Download menu (PBF / BKG / HTTP)     | `bun run download` (non-interactive: `--yes`, optional `--targets pbf,bkg,official` or `--all`)                                                                                                                 |
| Extract menu (OSM + official)        | `bun run extract` (TTY) or `bun run extract -- --yes` for both scopes non-interactively                                                                                                                         |
| OSM FlatGeobuf extract only          | `bun run extract:osm` (wizard) or `bun run --filter ./scripts extract:osm` (engine)                                                                                                                             |
| Geofabrik Germany PBF only           | `bun run download -- --yes --targets pbf` (add `--force` to re-fetch)                                                                                                                                           |
| Compare (interactive)                | `bun run compare`                                                                                                                                                                                               |
| Compare (non-interactive)            | `bun run compare -- --yes --area <folder>` or `bun run compare -- --yes` (all areas)                                                                                                                            |
| Compare one area (no menu, direct)   | `bun run scripts/compare/compare-boundaries.ts -- --area <folder>`                                                                                                                                              |
| Sync report static inputs            | `cd report && bun run sync-runtime-assets` (also runs after successful `bun run compare`)                                                                                                                       |
| Production build (from runtime tree) | `cd report && bun run build:with-runtime`                                                                                                                                                                       |
| Unit tests                           | `bun run test`                                                                                                                                                                                                  |

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
