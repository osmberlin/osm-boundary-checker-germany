# OSM boundary checker (Germany)

Compare official administrative boundaries (**FlatGeobuf**) with OpenStreetMap per dataset area, then explore results in a web UI.

## Quick start

Run everything from **this directory** (the Bun workspace root).

1. **Install** — [Bun](https://bun.sh/), then `bun install`. Put **tippecanoe**, **GDAL** (`ogr2ogr`), and **osmium-tool** on your `PATH` (see **Setup** below).
2. **Source data** — If you do not already have per-area `datasets/<slug>/source/official.fgb` and the shared OSM extract `.cache/osm/germany-admin-boundaries-rs.fgb`, run `bun run download` (large downloads; details under **Download**).
3. **Processing** — `bun run compare` (interactive area list). Non-interactive: `CI=1 bun run compare -- --area berlin-bezirke` or `bun run compare:boundaries -- --area berlin-bezirke`.
4. **Web app** — `bun run report:dev`, then open the printed URL (often [http://localhost:3000](http://localhost:3000)).

## Stack

**Bun** + **TypeScript**; compare uses **flatgeobuf**, **Turf**, **JSTS** (discrete Hausdorff), **proj4**; interactive picker **Clack** via `run.ts`. **Report**: **React** bundled/served by **Bun** (`index.html` + `Bun.serve`), **MapLibre**, **PMTiles**, **Tailwind**, **nuqs**. Workspaces: `scripts/`, `report/`.

## Setup

```bash
bun install
```

Install **[tippecanoe](https://github.com/felt/tippecanoe)**, **[GDAL](https://gdal.org/)** (`ogr2ogr`), and **[osmium-tool](https://osmcode.org/osmium-tool/)** on your PATH:

- **Tippecanoe** builds `comparison.pmtiles` from FlatGeobuf.
- **GDAL** converts GeoJSON, GPKG, etc. to `.fgb`, and reads **OSM `.pbf`** (via the OSM driver) into FlatGeobuf.
- **osmium-tool** filters large PBF extracts (e.g. Geofabrik Germany) before `ogr2ogr`, so you do not need Overpass, PostgreSQL, or **osm2pgsql** for that path.

**macOS (Homebrew):**

```bash
brew install tippecanoe gdal osmium-tool
```

On Linux, use your distro packages for `gdal-bin` and `osmium-tool`, and install tippecanoe from [its releases](https://github.com/felt/tippecanoe) or a community package.

## Compare (CLI)

Interactive (lists `datasets/*` folders that contain `config.jsonc`, or legacy `boundary-config.json`):

```bash
bun run compare
```

Non-interactive (CI, Docker): set `CI=1` and pass `--area <folder>` or omit `--area` to process **all** configured areas:

```bash
CI=1 bun run compare -- --area berlin-bezirke
CI=1 bun run compare -- --all
```

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

| Script | What it runs |
|--------|----------------|
| `download` | Full chain above |
| `download:bkg` | `bkg:download` then `bkg:extract` (ZIP → `.cache`, per-area `source/official.fgb` from VG25) |
| `download:bkg:fetch` / `download:bkg:extract` | BKG download or extract only |
| `download:official` | Areas with `config.jsonc` → `download.official` (HTTP GeoJSON) → `official.path` as FlatGeobuf; others log `skip` |
| `download:osm` | `osm:download` then `osm:extract` |
| `download:osm:fetch` / `download:osm:extract` | OSM steps only |

Legacy names still work: `download-osm-pbf` → `download:osm:fetch`, `extract-osm` → `download:osm:extract`, `download-bkg-vg25` → `download:bkg:fetch`, `extract-vg250` → `download:bkg:extract`.

**`download.official` in `config.jsonc`:** `kind` (`http`), `url`, `format` (`geojson` only for now), optional `crs` (for documentation / logs). WFS URLs should set the desired CRS with `srsName` / `SRSNAME` in the query string. Other WFS output formats (GML, Shapefile ZIP, etc.) are service-specific—check the service **GetCapabilities** if you need something other than GeoJSON.

**`download:official` flags:** `--area <folder>` for one dataset; `--force` to re-fetch even when the output `.fgb` already exists.

### Outputs per area (web UI)

- **`output/comparison_table.json`** — Metrics and row metadata for the main table (one row per **official** key: matched vs official-only). Includes `unmatchedOsm` (OSM polygons whose normalized `de:regionalschluessel` has no row in that area’s official FGB), `mapBbox` per row, `hasPmtiles`, and `hasUnmatchedPmtiles` when **`output/unmatched.pmtiles`** was built.
- **`output/comparison.pmtiles`** — Vector tiles for main compare (official + OSM overlays and diff patches for matched/official-only rows).
- **`output/unmatched.pmtiles`** — Optional tiles for **`unmatchedOsm`** geometries (same `source-layer` name as the main archive: `boundaries`).

Each run also writes **`history/comparison_table_<YYYY-MM-DD>.json`** (table data; tile flags cleared for history) and updates **`snapshots.json`** (`summary` includes `unmatchedOsm` count when present). Historic snapshot rows do not ship PMTiles files.

### Source data (FlatGeobuf)

Each dataset lives under **`datasets/<slug>/`** with **`source/official.fgb`**. OSM input for **all** compares is a **single shared** FlatGeobuf under **`.cache/osm/germany-admin-boundaries-rs.fgb`** produced by **`bun run osm:extract`**. Optional **`source/metadata.json`** records when data was fetched; the compare run embeds that into **`output/comparison_table.json`** for the report (“Quelldaten”). Legacy **`source/source-metadata.json`** is still read if present.

**`config.jsonc`** holds **`official.path`**, **`official.matchProperty`**, **`idNormalization`**, **`metricsCrs`**, optional **`download.official`** (for `download:official`), and optional **`ogcInspectSources`** / **`sources`** (documentation). There is no per-area OSM path or `osmExtract` block anymore.

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
# single area: bun run bkg:extract -- --area de-gemeinden
```

See [docs/vg25-bkg.md](docs/vg25-bkg.md) for URLs, `ogrinfo`, and layer notes.

**OSM PBF → shared OSM FlatGeobuf:** one **`ogr2ogr`** pass writes **`.cache/osm/germany-admin-boundaries-rs.fgb`**. It includes **every** administrative boundary with a non-empty **`de:regionalschluessel`**, and **Germany** (`admin_level=2`, `name=Deutschland`) with a **synthetic** `000000000000` when the tag is missing (Staat compare). Per-area `admin_level` filtering was removed so mismatched keys stay visible in **`unmatchedOsm`**.

```bash
bun run osm:download              # → .cache/osm/germany-latest.osm.pbf
bun run osm:extract               # → .cache/osm/germany-admin-boundaries-rs.fgb
bun run osm                       # download then extract
# Optional: OSM_GERMANY_PBF=...  or  --pbf /path/to/file.osm.pbf
# bun run osm:extract -- --dry-run
```

Under the hood: **`osmium tags-filter`** (`r/w boundary=administrative`) then **`ogr2ogr -f FlatGeobuf`** with **`OSM_CONFIG_FILE=scripts/osm/gdal-osm-boundaries.ini`** and a **SQLite** `-sql` that selects the broad predicate (see [`scripts/osm/extract-osm.ts`](scripts/osm/extract-osm.ts)). The `--area` flag is ignored (compat only).

Loading is implemented in [`scripts/compare/lib/loadFeatureCollection.ts`](scripts/compare/lib/loadFeatureCollection.ts); tippecanoe input is built in [`scripts/compare/lib/writeOutputs.ts`](scripts/compare/lib/writeOutputs.ts).

Intermediate **`geometries.fgb`** for tippecanoe is written under **`output/_build/`**, then removed after a successful run (that directory is gitignored).

### tippecanoe invocation

Implemented in [`scripts/compare/lib/runTippecanoe.ts`](scripts/compare/lib/runTippecanoe.ts): input **FlatGeobuf** (`.fgb`), layer name `boundaries`, **`--force`** (overwrite existing `comparison.pmtiles`), and topology-friendly options:

- `--no-simplification-of-shared-nodes`
- `--no-line-simplification`
- `--no-tiny-polygon-reduction`
- `--full-detail=14`

Adjust there if you need a different detail zoom or trade-off vs. file size.

## Tests

```bash
bun run test
# or: bun run test:scripts
```

## Report UI

Development (Bun bundles `./index.html`, HMR; `/datasets/*` and `/__areas.json` from repo root):

```bash
bun run report:dev
```

Open the printed URL (default port 3000). The home page loads **`__areas.json`** (committed at the repo root; regenerated before dev/build via `report/generateAreasJson.ts`). The UI loads **`comparison_table.json`** from `/datasets/<area>/output/…` and the map loads **`comparison.pmtiles`** via the `pmtiles://` protocol (filtered by `featureId` on the feature detail page).

Production build:

```bash
bun run report:build
```

Preview the static `dist/` output plus `datasets/` and `__areas.json` (same as dev):

```bash
bun run report:preview
```

Workspace scripts use Bun’s [`--filter`](https://bun.sh/docs/pm/filter) so you do not need to `cd` into `report/`.

The basemap uses **[OpenFreeMap](https://openfreemap.org/)** Positron (vector tiles, no API key). Attribution is handled by MapLibre per [OpenFreeMap](https://openfreemap.org/).

**Static deploy (GitHub Pages, Netlify, etc.):** Put the built app and the data on the **same origin**. Copy `report/dist/*` to the site root, and copy the repo’s **`datasets/`** folder and **`__areas.json`** next to it (same layout as this repository: `index.html`, `assets…`, `datasets/<area>/output/*.json`, `*.pmtiles`, `__areas.json`). The UI requests `/datasets/…` and `/__areas.json` — no extra `public/` folder. See [`report/src/data/paths.ts`](report/src/data/paths.ts).

**PMTiles:** The library uses HTTP **`Range`** requests against the `.pmtiles` URL ([`FetchSource`](https://github.com/protomaps/PMTiles/blob/main/js/src/v2.ts)); the response must expose **`Content-Length`** and, for range requests, **`206`** + **`Content-Range`**. **Local dev/preview** uses [`report/serveRepoDataResponse.ts`](report/serveRepoDataResponse.ts) (Node `fs` + `Range` handling; static file semantics, not an application API). **GitHub Pages, Netlify, S3 static website hosting, etc.** normally serve uploaded files with byte-range support automatically — you deploy `dist/` + `datasets/` + `__areas.json` only; no serverless functions or custom routes required for PMTiles.

The report registers the MapLibre `pmtiles://` protocol once at startup via [`report/src/main.tsx`](report/src/main.tsx) → [`report/src/lib/pmtilesMaplibreRegister.ts`](report/src/lib/pmtilesMaplibreRegister.ts) (see [PMTiles + MapLibre](https://github.com/protomaps/PMTiles#maplibre-gl-js)).

## Map / metrics notes

- Hausdorff distance uses **JSTS discrete** distance on **projected** geometries; it is not identical to Shapely’s continuous Hausdorff used in the Swiss reference.
