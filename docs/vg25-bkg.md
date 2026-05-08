# BKG VG25 (UTM32, GeoPackage in ZIP)

## Download

- **URL (aktuell):** [vg25.utm32s.gpkg.zip](https://daten.gdz.bkg.bund.de/produkte/vg/vg25_ebenen/aktuell/vg25.utm32s.gpkg.zip)

- https://gdz.bkg.bund.de/index.php/default/verwaltungsgebiete-1-25-000-stand-31-12-vg25.html

The unzipped product contains **`DE_VG25.gpkg`** (not `DE_VG250`). Polygon layers use the prefix **`vg25_`** (e.g. `vg25_gem`, `vg25_krs`).

Older products such as **VG250** (e.g. `DE_VG250.gpkg` under `vg250_ebenen_…`) use layers **`vg250_*`**. If you point `--gpkg` at such a file, update shared official profile mappings in `scripts/shared/officialProfiles.ts` accordingly.

## Workspace commands

From `osm-boundary-checker-germany/` (workspace root):

```bash
# Fetch ZIP into .cache/bkg/, unzip, write download-metadata.json
bun run download -- --yes --targets bkg

# Or copy an already downloaded ZIP (no HTTP) — scripts engine (pass-through flags after --)
bun run --filter ./scripts download:bkg -- --zip /path/to/vg25.utm32s.gpkg.zip

# Re-download from BKG
bun run download -- --yes --targets bkg --force
```

```bash
# GPKG → source/official.fgb for all BKG-profile areas (non-interactive)
bun run extract:official -- --yes

# Single area
bun run extract:official -- --area de-gemeinden

# Full network pull (PBF + BKG + HTTP) then official extract (typical local refresh)
bun run download -- --yes --all
bun run extract:official -- --yes
```

Override GeoPackage path (advanced; scripts engine keeps `--gpkg`):

```bash
bun run --filter ./scripts extract:bkg -- --yes --area de-laender --gpkg /path/to/DE_VG25.gpkg
```

## Prerequisites

- Bun
- GDAL (`ogr2ogr`)
- `unzip`

## Cache layout (ignored under `.cache/`)

- `.cache/bkg/vg25.utm32s.gpkg.zip`
- `.cache/bkg/extract/…` (unzipped tree, often `…/daten/DE_VG25.gpkg`)
- `.cache/bkg/download-metadata.json` — `sourceUpdatedAt`, `sourceUpdatedAtVerifiedAt`, `downloadedAt`, paths (see **Source timestamp contract** in [`docs/processing-and-analysis.md`](./processing-and-analysis.md)).

If you previously used `.cache/bkg-vg25/`, move that folder to `.cache/bkg/` or run `bun run download -- --yes --targets bkg` again so paths in `download-metadata.json` match.

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

Workspace area `config.jsonc` files can tune compare-side OSM matching via `osm.*` settings (`matchCriteria`, `ignoreRelationIds`, `extract`) plus top-level `osmProfile`. The shared polygon extract is built with `bun run extract:osm` or `bun run --filter ./scripts extract:osm -- --kind admin` — see [`scripts/osm/extract-osm.ts`](../scripts/osm/extract-osm.ts) `--help`.

Source SRS is usually **EPSG:25832**; extracts are reprojected to **WGS84** for `.fgb` inputs.
