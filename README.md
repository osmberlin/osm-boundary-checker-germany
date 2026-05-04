# OSM boundary checker (Germany)

Compare official administrative boundaries (**FlatGeobuf**) with OpenStreetMap per dataset area, then explore results in a web UI.

## Quick start

Run everything from **this directory** on your local system.

1. **Install** — Bun, Rust toolchain, `osmium-tool`, GDAL (`ogr2ogr`), `tippecanoe`, `unzip`.
2. **Install dependencies** — `bun install`.
3. **Source data + processing** — `bun run pipeline:nightly`.
4. **Web app** — `bun run report:dev`, then open the printed local URL.

## Local prerequisite (Rust sidecar)

Compare runs require the Rust geometry sidecar.

```bash
bun run rust:build
```

If compare fails:

- binary missing: run `bun run rust:build` again
- custom binary location: set `RUST_GEOM_BIN=/absolute/path/to/geom-sidecar`
- performance triage: inspect `data/internal-compare-timing.jsonl`

## Stack

**Bun** + **TypeScript**; compare uses **flatgeobuf**, **Turf**, **JSTS** (discrete Hausdorff), **proj4**; interactive picker **Clack** via `run.ts`. **Report**: **React** + **Vite** build, Bun dev/preview data serving, **MapLibre**, **PMTiles**, **Tailwind**, **TanStack Router**, **Zod**. Workspaces: `scripts/`, `report/`.

## Folder contract

- **`scripts/`** — Processing pipeline (download, extract, compare, nightly orchestration).
- **`datasets/`** — Per-area inputs/config + generated comparison outputs (`output/*.json`, `*.pmtiles`, `snapshots.json`).
- **`data/`** — Processing status logs (`processing-state.json`, `processing-log.jsonl`) used by UI status pages.
- **`report/`** — Frontend app and static bundle assembly (`prepareStaticSnapshot.ts`, `generateAreasJson.ts`, Vite build).
- **`.cache/`** — Download and extract caches (transient, gitignored).

`DATA_ROOT` controls where runtime `datasets/` and `data/` are read from. Default is repo root.

## Canonical commands

- **Prepare runtime data**: `bun run pipeline:nightly` (or `bun run download` + `bun run compare`).
- **Quick test run without BKG download**: `CI=1 bun run download:official && bun run download:osm:extract && bun run compare -- --all`.
- **Full refresh run**: `bun run pipeline:nightly`.
- **Sync report inputs from runtime tree**: `bun run report:sync-runtime-assets`.
- **Build static app shell only**: `bun run report:build:app` (expects synced `report/public/*` + generated `report/src/data/areasIndex.gen.ts`).
- **Build full static bundle from runtime tree**: `bun run report:build`.

Use the canonical `download:*` / `osm:*` / `bkg:*` command names.

## Setup

Install system dependencies on your machine:

- Bun
- Rust toolchain
- `tippecanoe`
- GDAL (`ogr2ogr`)
- `osmium-tool`
- `unzip`

## Compare (CLI)

Interactive (lists `datasets/*` folders that contain `config.jsonc`):

```bash
bun run compare
```

Non-interactive (CI/local scripts): set `CI=1` and pass `--area <folder>` or omit `--area` to process **all** configured areas:

```bash
CI=1 bun run compare -- --area berlin-bezirke
CI=1 bun run compare -- --all
```

`de-gemeinden-*` state areas are compared directly. Their `source/official.fgb` files are prepared by `bun run bkg:extract` from the shared VG25 cache using ARS-prefix filters.

Single area without the root wrapper (no Clack), same as `bun run --filter ./scripts compare`:

```bash
bun run compare:boundaries -- --area berlin-bezirke
```

Or invoke the compare script directly:

```bash
bun scripts/compare/compare-boundaries.ts --area berlin-bezirke
```

## Download (prepare source data)

One command runs BKG VG25 cache + extract, config-driven HTTP official sources (where defined), then OSM PBF + shared extract:

```bash
bun run download
```

This is a **`package.json` chain** (not a monolithic script): `download:bkg && download:official && download:osm`.

| Script                                        | What it runs                                                                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `download`                                    | Full chain above                                                                                                                                                           |
| `download:bkg`                                | `bkg:download` then `bkg:extract` (ZIP → `.cache`, per-area `source/official.fgb` from VG25)                                                                               |
| `download:bkg:fetch` / `download:bkg:extract` | BKG download or extract only                                                                                                                                               |
| `download:official`                           | Areas with `config.jsonc` → `official.download` (HTTP GeoJSON) → `source/official.fgb` as FlatGeobuf; cache-aware daily refresh window logs explicit skip/download reasons |
| `download:osm`                                | `osm:download` then `osm:extract`                                                                                                                                          |
| `download:osm:fetch` / `download:osm:extract` | OSM steps only                                                                                                                                                             |

**`official.download` in `config.jsonc`:** `kind` (`http`), `url`, `format` (`geojson` or `gml`), optional `crs` (for documentation / logs). WFS URLs should set the desired CRS with `srsName` / `SRSNAME` in the query string. Other WFS output formats are service-specific—check the service **GetCapabilities**.

**`download:official` flags:** `--area <folder>` for one dataset; `--force` to re-fetch even when cache would otherwise be reused. Default policy refreshes at most once per day, only after 01:00 local time (timezone from `DOWNLOAD_REFRESH_TIMEZONE`, then `PIPELINE_TIMEZONE`, then `TZ`, fallback `Europe/Berlin`).

### Outputs per area (web UI)

- **`output/comparison_table.json`** — Full latest comparison payload used by the area report.
- **`output/features/*.json`** — Feature detail payload shards for `/feature/<key>`.
- **`snapshots.json`** — Historic run summary index per area.
- **`output/comparison.pmtiles`** — Vector tiles for main compare (official + OSM overlays and diff patches for matched/official-only rows).
- **`output/unmatched.pmtiles`** — Optional tiles for **`unmatchedOsm`** geometries (same `source-layer` name as the main archive: `boundaries`).
- **`output/official_for_edit/*.geojson`** — Per-feature edit helpers for updating OSM boundaries.

For `de-gemeinden-*` areas, compare writes `comparison_table.json`, `features/*.json`, `snapshots.json`, and PMTiles directly per state area.

### Source data (FlatGeobuf)

Each dataset lives under **`datasets/<slug>/`** with **`source/official.fgb`**. Compare payloads are written as static JSON under `datasets/<slug>/output/` plus `snapshots.json`, while map artifacts stay file-based in `datasets/<slug>/output/*.pmtiles`. **Gitignored (local / CI / deploy bundle):** downloaded **`*.fgb`**, **`*.pmtiles`**, tippecanoe **`output/_build/`**, and compare-generated GeoJSON under **`output/official_for_edit/`** — see **[`datasets/.gitignore`](datasets/.gitignore)**. OSM input uses top-level `osmProfile` (shared registries under `.cache/osm/`: `admin_rs` → `germany-admin-boundaries-rs.fgb`, `postal_code` → `germany-postal-code-boundaries.fgb`). Optional **`source/metadata.json`** records when data was fetched and is embedded into compare payload provenance.

**`config.jsonc`** is the only human-authored per-area setup file. It holds **`displayName`**, top-level **`osmProfile`**, optional top-level **`officialProfile`** (profile-driven BKG mode), or an **`official`** block for direct HTTP mode with optional **`official.extractLayer`**, optional **`official.extractFilter`** (`property` + `valuePrefix` for scoped BKG extraction), optional **`official.download`**, optional **`official.source`**, optional **`official.constantMatchKey`**, and optional **`official.keyTransposition`** (map official IDs to raw OSM-style keys when the source has no compatible Schlüssel). Compare settings live under **`compare`** with required **`compare.officialMatchProperty`**, required **`compare.bboxFilter`**, optional **`compare.bboxBufferDegrees`**, and required **`compare.osmScopeFilter`**. Optional **`osm`** contains `matchCriteria`, `ignoreRelationIds`, and `extract` overrides. Optional **`ogcInspectSources`** configures live WFS lookups in report feature detail.

**Clean-state rule:** legacy keys **`sources`** and **`osmExtract`** are no longer supported.

### Requesting a new dataset

Open a GitHub issue using the **Dataset request** form under `.github/ISSUE_TEMPLATE/dataset-request.yml`.
The form captures required provenance and license fields used for source metadata, plus optional API and OSM compatibility details that help setup.

Convert from GeoJSON (or GPKG, etc.) with GDAL:

```bash
ogr2ogr -f FlatGeobuf output.fgb input.geojson
```

#### BKG VG25 (national administrative layers)

Download the official **ZIP**, cache it under **`.cache/bkg/`** (ignored via [`.cache/.gitignore`](.cache/.gitignore)), and extract layers to `source/official.fgb` per area:

```bash
bun run bkg:download
# or: bun run bkg:download -- --zip ~/Downloads/vg25.utm32s.gpkg.zip
bun run bkg:extract
# both: bun run bkg
# single area: bun run bkg:extract -- --area de-gemeinden-be
```

See [docs/vg25-bkg.md](docs/vg25-bkg.md) for URLs, `ogrinfo`, and layer notes.

**OSM PBF → shared OSM FlatGeobuf:** one **`ogr2ogr`** pass writes **`.cache/osm/germany-admin-boundaries-rs.fgb`** (default `--kind admin`). It includes administrative boundaries with a non-empty **`de:regionalschluessel`** only. Geofabrik source/provider/licence defaults are centralized in `scripts/shared/germanyOsmPbf.ts` (not duplicated in per-area configs). For `de-staat`, matching is configured via Germany relation identity (`relation/51477`) instead of synthetic RS injection. Per-area `admin_level` filtering was removed so mismatched keys stay visible in **`unmatchedOsm`**.

```bash
bun run osm:download              # → .cache/osm/germany-latest.osm.pbf
bun run osm:extract               # → .cache/osm/germany-admin-boundaries-rs.fgb
bun run osm                       # download then extract
# Optional: OSM_GERMANY_PBF=...  or  --pbf /path/to/file.osm.pbf
# bun run osm:extract -- --dry-run
```

Under the hood: **`osmium tags-filter`** then **`ogr2ogr -f FlatGeobuf`** with **`OSM_CONFIG_FILE=scripts/osm/gdal-osm-boundaries.ini`** and a **SQLite** `-sql` selected by `--kind` (admin/plz) in [`scripts/osm/extract-osm.ts`](scripts/osm/extract-osm.ts). The `--area` flag is ignored (compat only).

Loading is implemented in [`scripts/compare/lib/loadFeatureCollection.ts`](scripts/compare/lib/loadFeatureCollection.ts); tippecanoe input is built in [`scripts/compare/lib/writeOutputs.ts`](scripts/compare/lib/writeOutputs.ts).

Intermediate **`geometries.fgb`** for tippecanoe is written under **`output/_build/`**, then removed after a successful run (that directory is gitignored).

### tippecanoe invocation

Implemented in [`scripts/compare/lib/runTippecanoe.ts`](scripts/compare/lib/runTippecanoe.ts): input **FlatGeobuf** (`.fgb`), layer name `boundaries`, **`--force`** (overwrite existing `comparison.pmtiles`), and a zoom policy optimized for payload:

- `--maximum-zoom=15`
- `--full-detail=15` (full detail at z15)
- `--low-detail=11` (more geometry kept around z10)
- `--simplification=4` (reduced simplification strength; better ~500m-level fidelity at z10)
- `--detect-shared-borders` (topology-aware simplification for adjacent polygons)
- `--drop-densest-as-needed`

Adjust there if you need a different detail zoom or trade-off vs. file size.

## Tests

```bash
bun run test
# or: bun run test:scripts
```

## Report UI

Development (Vite dev server; static payloads from `/datasets/*` + `/data/*` and imported `areasIndex.gen.ts`):

```bash
bun run report:dev
```

Open the printed URL (default port 3000). The home/detail pages load precomputed static payloads (`report/src/data/areasIndex.gen.ts`, `datasets/<area>/output/*.json`), and the map loads `comparison.pmtiles` via the `pmtiles://` protocol (filtered by `featureId` on the feature detail page).

Production build from the current runtime tree (`DATA_ROOT` or repo root):

```bash
bun run report:build
```

Preview the static `dist/` output plus static dataset/data serving (same as dev):

```bash
bun run report:preview
```

Workspace scripts use Bun’s [`--filter`](https://bun.sh/docs/pm/filter) so you do not need to `cd` into `report/`.

The basemap uses **[OpenFreeMap](https://openfreemap.org/)** Positron (vector tiles, no API key). Attribution is handled by MapLibre per [OpenFreeMap](https://openfreemap.org/).

**Deploy:** Put the built app and data on the same static host. Serve `report/dist/*` including copied `datasets/` and `data/` assets. Deterministic CI order should be:

1. restore/prepare runtime tree (`datasets/`, `data/`)
2. `bun run report:sync-runtime-assets`
3. verify `report/src/data/areasIndex.gen.ts` is non-empty
4. `bun run report:build:app`
5. deploy `report/dist`

See [`report/src/data/paths.ts`](report/src/data/paths.ts).

**PMTiles:** The library uses HTTP **`Range`** requests against the `.pmtiles` URL ([`FetchSource`](https://github.com/protomaps/PMTiles/blob/main/js/src/v2.ts)); the response must expose **`Content-Length`** and, for range requests, **`206`** + **`Content-Range`**. **Local dev/preview** uses [`report/serveRepoDataResponse.ts`](report/serveRepoDataResponse.ts) (Node `fs` + `Range` handling; static file semantics). Production hosting should preserve byte-range support for PMTiles files.

Smoke-test a deployed PMTiles URL:

```bash
curl -I "https://grenzabgleich.osm-verkehrswende.org/datasets/<area>/output/comparison.pmtiles"
curl -I -H "Range: bytes=0-15" "https://grenzabgleich.osm-verkehrswende.org/datasets/<area>/output/comparison.pmtiles"
```

Expected: first response includes `Content-Length`; second returns `206 Partial Content` with `Content-Range`.

**GitHub Pages custom domain** (e.g. `https://grenzabgleich.osm-verkehrswende.org/`): add the hostname under repo **Settings → Pages → Custom domain** before pointing DNS. At your DNS provider, set a **`CNAME`** for `grenzabgleich` to **`<github-org-or-user>.github.io`** (no repository path in the target). For takeover protection, verify the domain under org **Settings → Pages → Add a domain** and keep the TXT record GitHub shows ([verify for Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages), [manage custom domain](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)). Publishing uses Actions; no `CNAME` file in the repo is required.

The report registers the MapLibre `pmtiles://` protocol once at startup via [`report/src/main.tsx`](report/src/main.tsx) → [`report/src/lib/pmtilesMaplibreRegister.ts`](report/src/lib/pmtilesMaplibreRegister.ts) (see [PMTiles + MapLibre](https://github.com/protomaps/PMTiles#maplibre-gl-js)).

## Map / metrics notes

- Hausdorff distance uses **JSTS discrete** distance on **projected** geometries; it is not identical to Shapely’s continuous Hausdorff used in the Swiss reference.
- Data-size analysis script: `bun run report:data-sizes` (writes `analysis/out/data-size-report.md`).
