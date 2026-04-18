# OSM boundary checker (Germany)

Compare official administrative boundaries (**FlatGeobuf**) with OpenStreetMap per dataset area, then explore results in a web UI.

## Quick start

Run everything from **this directory** with Docker Compose.

1. **Install** — Docker + Docker Compose.
2. **Build** — `docker compose build`.
3. **Source data + processing** — `docker compose run --rm pipeline bun run pipeline:nightly`.
4. **Web app** — `docker compose up web`, then open [http://localhost:4173](http://localhost:4173).

Docker Compose uses a shared volume mounted at `/data` with `DATA_ROOT=/data`, so generated datasets, caches, and processing logs survive redeploys.

## Stack

**Bun** + **TypeScript**; compare uses **flatgeobuf**, **Turf**, **JSTS** (discrete Hausdorff), **proj4**; interactive picker **Clack** via `run.ts`. **Report**: **React** bundled/served by **Bun** (`index.html` + `Bun.serve`), **MapLibre**, **PMTiles**, **Tailwind**, **nuqs**. Workspaces: `scripts/`, `report/`.

## Setup

```bash
docker compose build
```

The Docker image contains **Bun**, **tippecanoe**, **GDAL** (`ogr2ogr`), **osmium-tool**, and **unzip**.
Host installs for these tools are intentionally not required for normal repo work.

## Compare (CLI)

Interactive (lists `datasets/*` folders that contain `config.jsonc`, or legacy `boundary-config.json`):

```bash
docker compose run --rm pipeline bun run compare
```

Non-interactive (CI, Docker): set `CI=1` and pass `--area <folder>` or omit `--area` to process **all** configured areas:

```bash
docker compose run --rm pipeline env CI=1 bun run compare -- --area berlin-bezirke
docker compose run --rm pipeline env CI=1 bun run compare -- --all
```

Single area without the root wrapper (no Clack), same as `bun run --filter ./scripts compare`:

```bash
docker compose run --rm pipeline bun run compare:boundaries -- --area berlin-bezirke
```

Or invoke the compare script directly:

```bash
docker compose run --rm pipeline bun scripts/compare/compare-boundaries.ts --area berlin-bezirke
```

## Download (prepare source data)

One command runs BKG VG25 cache + extract, config-driven HTTP official sources (where defined), then OSM PBF + shared extract:

```bash
docker compose run --rm pipeline bun run download
```

This is a **`package.json` chain** (not a monolithic script): `download:bkg && download:official && download:osm`.

| Script                                        | What it runs                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `download`                                    | Full chain above                                                                                                  |
| `download:bkg`                                | `bkg:download` then `bkg:extract` (ZIP → `.cache`, per-area `source/official.fgb` from VG25)                      |
| `download:bkg:fetch` / `download:bkg:extract` | BKG download or extract only                                                                                      |
| `download:official`                           | Areas with `config.jsonc` → `download.official` (HTTP GeoJSON) → `official.path` as FlatGeobuf; others log `skip` |
| `download:osm`                                | `osm:download` then `osm:extract`                                                                                 |
| `download:osm:fetch` / `download:osm:extract` | OSM steps only                                                                                                    |

Legacy names still work: `download-osm-pbf` → `download:osm:fetch`, `extract-osm` → `download:osm:extract`, `download-bkg-vg25` → `download:bkg:fetch`, `extract-vg250` → `download:bkg:extract`.

**`download.official` in `config.jsonc`:** `kind` (`http`), `url`, `format` (`geojson` only for now), optional `crs` (for documentation / logs). WFS URLs should set the desired CRS with `srsName` / `SRSNAME` in the query string. Other WFS output formats (GML, Shapefile ZIP, etc.) are service-specific—check the service **GetCapabilities** if you need something other than GeoJSON.

**`download:official` flags:** `--area <folder>` for one dataset; `--force` to re-fetch even when the output `.fgb` already exists.

### Outputs per area (web UI)

- **Runtime DB (`data/runtime.sqlite`)** — Comparison rows, row properties, unmatched rows, per-run summaries, and source metadata (queried via `/api/areas/*`).
- **`output/comparison.pmtiles`** — Vector tiles for main compare (official + OSM overlays and diff patches for matched/official-only rows).
- **`output/unmatched.pmtiles`** — Optional tiles for **`unmatchedOsm`** geometries (same `source-layer` name as the main archive: `boundaries`).
- **`output/official_for_edit/*.geojson`** — Per-feature edit helpers for updating OSM boundaries.

### Source data (FlatGeobuf)

Each dataset lives under **`datasets/<slug>/`** with **`source/official.fgb`**. Runtime compare payloads are persisted in **`data/runtime.sqlite`** (under `DATA_ROOT`), while map artifacts stay file-based in `datasets/<slug>/output/*.pmtiles`. **Gitignored (local / CI / deploy bundle):** downloaded **`*.fgb`**, **`*.pmtiles`**, tippecanoe **`output/_build/`**, and compare-generated GeoJSON under **`output/official_for_edit/`** — see **[`datasets/.gitignore`](datasets/.gitignore)**. OSM input for **all** compares is a **single shared** FlatGeobuf under **`.cache/osm/germany-admin-boundaries-rs.fgb`** produced by **`bun run osm:extract`**. Optional **`source/metadata.json`** records when data was fetched and is embedded into runtime DB entries for report provenance. Legacy **`source/source-metadata.json`** is still read if present.

**`config.jsonc`** holds **`official.path`**, **`official.matchProperty`**, optional **`official.keyTransposition`** (map official IDs → `de:regionalschluessel` when the source has no Schlüssel), **`idNormalization`**, **`metricsCrs`**, optional **`compare.applyBboxFilter`** / **`compare.bboxBufferDegrees`** (prefilter shared OSM features by a buffered bbox around official data), optional **`download.official`** (for `download:official`), and optional **`ogcInspectSources`** / **`sources`** (documentation). There is no per-area OSM path or `osmExtract` block anymore.

Convert from GeoJSON (or GPKG, etc.) with GDAL:

```bash
ogr2ogr -f FlatGeobuf output.fgb input.geojson
```

#### BKG VG25 (national administrative layers)

Download the official **ZIP**, cache it under **`.cache/bkg/`** (ignored via [`.cache/.gitignore`](.cache/.gitignore)), and extract layers to `source/official.fgb` per area:

```bash
docker compose run --rm pipeline bun run bkg:download
# or: bun run bkg:download -- --zip ~/Downloads/vg25.utm32s.gpkg.zip
docker compose run --rm pipeline bun run bkg:extract
# both: bun run bkg
# single area: bun run bkg:extract -- --area de-gemeinden
```

See [docs/vg25-bkg.md](docs/vg25-bkg.md) for URLs, `ogrinfo`, and layer notes.

**OSM PBF → shared OSM FlatGeobuf:** one **`ogr2ogr`** pass writes **`.cache/osm/germany-admin-boundaries-rs.fgb`**. It includes **every** administrative boundary with a non-empty **`de:regionalschluessel`**, and **Germany** (`admin_level=2`, `name=Deutschland`) with a **synthetic** `000000000000` when the tag is missing (Staat compare). Per-area `admin_level` filtering was removed so mismatched keys stay visible in **`unmatchedOsm`**.

```bash
docker compose run --rm pipeline bun run osm:download              # → .cache/osm/germany-latest.osm.pbf
docker compose run --rm pipeline bun run osm:extract               # → .cache/osm/germany-admin-boundaries-rs.fgb
docker compose run --rm pipeline bun run osm                       # download then extract
# Optional: OSM_GERMANY_PBF=...  or  --pbf /path/to/file.osm.pbf
# bun run osm:extract -- --dry-run
```

Under the hood: **`osmium tags-filter`** (`r/w boundary=administrative`) then **`ogr2ogr -f FlatGeobuf`** with **`OSM_CONFIG_FILE=scripts/osm/gdal-osm-boundaries.ini`** and a **SQLite** `-sql` that selects the broad predicate (see [`scripts/osm/extract-osm.ts`](scripts/osm/extract-osm.ts)). The `--area` flag is ignored (compat only).

Loading is implemented in [`scripts/compare/lib/loadFeatureCollection.ts`](scripts/compare/lib/loadFeatureCollection.ts); tippecanoe input is built in [`scripts/compare/lib/writeOutputs.ts`](scripts/compare/lib/writeOutputs.ts).

Intermediate **`geometries.fgb`** for tippecanoe is written under **`output/_build/`**, then removed after a successful run (that directory is gitignored).

### tippecanoe invocation

Implemented in [`scripts/compare/lib/runTippecanoe.ts`](scripts/compare/lib/runTippecanoe.ts): input **FlatGeobuf** (`.fgb`), layer name `boundaries`, **`--force`** (overwrite existing `comparison.pmtiles`), and a zoom policy optimized for payload:

- `--maximum-zoom=15`
- `--full-detail=15` (full detail at z15)
- `--low-detail=9`
- `--simplification=10`
- `--drop-densest-as-needed`

Adjust there if you need a different detail zoom or trade-off vs. file size.

## Tests

```bash
docker compose run --rm pipeline bun run test
# or: bun run test:scripts
```

## Report UI

Development (Bun bundles `./index.html`, HMR; `/api/areas*` from SQLite + `/datasets/*` PMTiles/static artifacts):

```bash
docker compose up web
```

Open the printed URL (default port 3000). The home page and detail pages load comparison payloads from `/api/areas/*` (runtime SQLite), and the map loads `comparison.pmtiles` via the `pmtiles://` protocol (filtered by `featureId` on the feature detail page).

Production build:

```bash
docker compose run --rm pipeline bun run report:build
```

Preview the static `dist/` output plus runtime API/static data serving (same as dev):

```bash
docker compose run --rm web bun run report:preview
```

Workspace scripts use Bun’s [`--filter`](https://bun.sh/docs/pm/filter) so you do not need to `cd` into `report/`.

The basemap uses **[OpenFreeMap](https://openfreemap.org/)** Positron (vector tiles, no API key). Attribution is handled by MapLibre per [OpenFreeMap](https://openfreemap.org/).

**Deploy:** Put the built app and data on the same host. Serve `report/dist/*`, static `datasets/` PMTiles files, and provide `/api/areas*` endpoints backed by the runtime SQLite DB (`data/runtime.sqlite`). See [`report/src/data/paths.ts`](report/src/data/paths.ts).

**PMTiles:** The library uses HTTP **`Range`** requests against the `.pmtiles` URL ([`FetchSource`](https://github.com/protomaps/PMTiles/blob/main/js/src/v2.ts)); the response must expose **`Content-Length`** and, for range requests, **`206`** + **`Content-Range`**. **Local dev/preview** uses [`report/serveRepoDataResponse.ts`](report/serveRepoDataResponse.ts) (Node `fs` + `Range` handling; static file semantics). Production hosting should preserve byte-range support for PMTiles files.

The report registers the MapLibre `pmtiles://` protocol once at startup via [`report/src/main.tsx`](report/src/main.tsx) → [`report/src/lib/pmtilesMaplibreRegister.ts`](report/src/lib/pmtilesMaplibreRegister.ts) (see [PMTiles + MapLibre](https://github.com/protomaps/PMTiles#maplibre-gl-js)).

## Map / metrics notes

- Hausdorff distance uses **JSTS discrete** distance on **projected** geometries; it is not identical to Shapely’s continuous Hausdorff used in the Swiss reference.
- Runtime data-store recommendation (SQLite/Turso track): [`docs/runtime-storage.md`](docs/runtime-storage.md).
