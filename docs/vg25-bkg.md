# BKG VG25 (UTM32, GeoPackage in ZIP)

## Download

- **URL (aktuell):** [vg25.utm32s.gpkg.zip](https://daten.gdz.bkg.bund.de/produkte/vg/vg25_ebenen/aktuell/vg25.utm32s.gpkg.zip)

- https://gdz.bkg.bund.de/index.php/default/verwaltungsgebiete-1-25-000-stand-31-12-vg25.html

The unzipped product contains **`DE_VG25.gpkg`** (not `DE_VG250`). Polygon layers use the prefix **`vg25_`** (e.g. `vg25_gem`, `vg25_krs`).

Older products such as **VG250** (e.g. `DE_VG250.gpkg` under `vg250_ebenen_…`) use layers **`vg250_*`**. If you point `--gpkg` at such a file, update shared official profile mappings in `scripts/shared/officialProfiles.ts` accordingly.

## Workspace commands (Docker)

From `osm-boundary-checker-germany/` (workspace root):

```bash
# Fetch ZIP into .cache/bkg/, unzip, write download-metadata.json
docker compose run --rm pipeline bun run bkg:download

# Or copy an already downloaded ZIP (no HTTP)
docker compose run --rm pipeline bun run bkg:download -- --zip /data/import/vg25.utm32s.gpkg.zip

# Re-download from BKG
docker compose run --rm pipeline bun run bkg:download -- --force
```

```bash
# GPKG → source/official.fgb for all areas that define `officialProfile` (default; no flags)
docker compose run --rm pipeline bun run bkg:extract

# Single area
docker compose run --rm pipeline bun run bkg:extract -- --area de-gemeinden

# Download + extract
docker compose run --rm pipeline bun run bkg
```

Override GeoPackage path:

```bash
docker compose run --rm pipeline bun run bkg:extract -- --area de-laender --gpkg /path/to/DE_VG25.gpkg
```

Legacy script names `download-bkg-vg25` and `extract-vg250` still map to `bkg:download` and `bkg:extract`.

## Prerequisites

- Docker + Docker Compose
- The container image provides GDAL (`ogr2ogr`) and `unzip`

## Cache layout (ignored under `.cache/`)

- `.cache/bkg/vg25.utm32s.gpkg.zip`
- `.cache/bkg/extract/…` (unzipped tree, often `…/daten/DE_VG25.gpkg`)
- `.cache/bkg/download-metadata.json` — includes `downloadedAt`, `gpkgRelativePath`

If you previously used `.cache/bkg-vg25/`, move that folder to `.cache/bkg/` or run `bkg:download` again so paths in `download-metadata.json` match.

## Inspect layers and attributes

```bash
ogrinfo -so .cache/bkg/extract/daten/DE_VG25.gpkg
```

**VG25 (aktuell ZIP):** `vg25_sta`, `vg25_lan`, `vg25_rbz`, `vg25_krs`, `vg25_gem`, `vg25_vwg`, …

**VG250 (older GPKG):** `vg250_sta`, `vg250_lan`, …

Match keys for OSM often use **ARS** (12-digit) or **AGS** (8-digit); confirm column names for your product vintage and set `matchProperty` + `idNormalization.preset` in each area’s `config.jsonc`.

## Layer → preset cheat sheet (verify with `ogrinfo`)

| Layer (VG25 aktuell) | Typical use  | OSM tag (often)         | Preset (starting point) | OSM `admin_level` (Germany, rough)                                                                                       |
| -------------------- | ------------ | ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `vg25_gem`           | Gemeinden    | `de:regionalschluessel` | `regional-12`           | `8`                                                                                                                      |
| `vg25_krs`           | Kreise       | `de:regionalschluessel` | `regional-12`           | `6`                                                                                                                      |
| `vg25_lan`           | Bundesländer | `de:regionalschluessel` | `regional-12`           | `4`                                                                                                                      |
| `vg25_rbz`           | Reg.-Bezirke | `de:regionalschluessel` | `regional-12`           | `5`                                                                                                                      |
| `vg25_sta`           | Staatsgebiet | (Landesgrenze)          | `regional-12`           | `2` (see `datasets/de-staat/config.jsonc` for relation-based matching via OSM `relation/51477`)                          |
| `vg25_vwg`           | VWG          | (variiert)              | `regional-12`           | often `7`; OSM coverage can be much lower than BKG — review OSM tagging coverage and compare matching config when needed |

Workspace area `config.jsonc` files can tune compare-side OSM matching via `osm.*` settings (`matchCriteria`, `ignoreRelationIds`, `extract`) plus top-level `osmProfile`. The shared extract itself is built by `bun run osm:extract`.

Source SRS is usually **EPSG:25832**; extracts are reprojected to **WGS84** for `.fgb` inputs.
