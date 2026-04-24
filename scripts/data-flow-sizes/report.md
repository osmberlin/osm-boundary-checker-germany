# Data flow size report

Generated: 2026-04-24T06:43:01.781Z
Workspace root: `/Users/tordans/Development/OSM/boundary-checker/osm-boundary-checker-germany`
Runtime root: `/Users/tordans/Development/OSM/boundary-checker/osm-boundary-checker-germany`

## Runtime processing footprint (`datasets/...`)

- Total files: **34419**
- Total size: **3621.10 MiB**

### Runtime categories

| Category                 | Files |        Size |
| ------------------------ | ----: | ----------: |
| official_for_edit        | 17151 | 1917.62 MiB |
| unmatched_pmtiles        |    10 |  570.23 MiB |
| other_internal_or_source |    58 |  554.37 MiB |
| comparison_pmtiles       |    12 |  493.43 MiB |
| feature_shards           | 17151 |   40.07 MiB |
| comparison_table_json    |    12 |   33.43 MiB |
| unmatched_json           |    12 |   11.95 MiB |
| snapshots                |    12 |    0.00 MiB |
| other                    |     1 |    0.00 MiB |

### Largest runtime files (global)

- `datasets/de-gemeinden/output/comparison.pmtiles` - 227.37 MiB (238416599 bytes)
- `datasets/de-gemeinden/source/official.fgb` - 164.98 MiB (172999304 bytes)
- `datasets/de-laender/output/unmatched.pmtiles` - 144.99 MiB (152029608 bytes)
- `datasets/de-verwaltungsgemeinschaften/output/comparison.pmtiles` - 128.33 MiB (134566835 bytes)
- `datasets/de-regierungsbezirke/output/unmatched.pmtiles` - 122.41 MiB (128354096 bytes)
- `datasets/de-verwaltungsgemeinschaften/source/official.fgb` - 120.09 MiB (125920176 bytes)
- `datasets/de-verwaltungsgemeinschaften/output/unmatched.pmtiles` - 119.05 MiB (124828429 bytes)
- `datasets/de-landkreise/output/unmatched.pmtiles` - 118.66 MiB (124428864 bytes)
- `datasets/de-gemeinden/source/osm.fgb` - 110.87 MiB (116252904 bytes)
- `datasets/de-landkreise/output/comparison.pmtiles` - 62.11 MiB (65125297 bytes)
- `datasets/de-gemeinden/output/unmatched.pmtiles` - 58.36 MiB (61195864 bytes)
- `datasets/de-landkreise/source/official.fgb` - 42.79 MiB (44865320 bytes)
- `datasets/de-landkreise/source/osm.fgb` - 32.62 MiB (34204392 bytes)
- `datasets/de-verwaltungsgemeinschaften/source/osm.fgb` - 27.90 MiB (29258280 bytes)
- `datasets/de-laender/output/comparison.pmtiles` - 21.39 MiB (22425358 bytes)
- `datasets/brandenburg-berlin-plz/output/comparison.pmtiles` - 16.50 MiB (17301758 bytes)
- `datasets/de-staat/output/official_for_edit/514770000000.geojson` - 16.12 MiB (16900336 bytes)
- `datasets/de-gemeinden/output/comparison_table.json` - 15.03 MiB (15756203 bytes)
- `datasets/brandenburg-gemeinden/output/comparison.pmtiles` - 14.75 MiB (15470117 bytes)
- `datasets/de-laender/source/official.fgb` - 12.79 MiB (13414088 bytes)

### Per-area runtime totals

| Area                         | Files |        Size |
| ---------------------------- | ----: | ----------: |
| berlin-bezirke               |    34 |    4.22 MiB |
| de-staat                     |    12 |   31.09 MiB |
| de-gemeinden                 | 21973 | 1476.54 MiB |
| berlin-ortsteile             |   203 |    9.17 MiB |
| hamburg-bezirke              |    23 |    2.44 MiB |
| brandenburg-gemeinden        |   834 |   21.60 MiB |
| de-verwaltungsgemeinschaften |  9209 | 1056.72 MiB |
| berlin-plz                   |   393 |    7.93 MiB |
| brandenburg-berlin-plz       |   828 |   67.73 MiB |
| de-regierungsbezirke         |    49 |  204.31 MiB |
| de-landkreise                |   817 |  494.27 MiB |
| de-laender                   |    43 |  245.08 MiB |

## Action rules from compare output generation

| Pattern                              | Behavior             | Why                                                             |
| ------------------------------------ | -------------------- | --------------------------------------------------------------- |
| `snapshots.json`                     | preserved            | updated/merged on each compare run to keep historical summaries |
| `output/comparison_table.json`       | preserved            | main area payload consumed by report area page                  |
| `output/unmatched.json`              | preserved            | unmatched OSM payload consumed by report                        |
| `output/features/*.json`             | preserved            | feature-level API shards for detail route                       |
| `output/official_for_edit/*.geojson` | preserved            | official geometry exports for edit/download                     |
| `output/comparison.pmtiles`          | preserved            | comparison map layer used by MapLibre via PMTiles               |
| `output/unmatched.pmtiles`           | preserved            | unmatched layer used by MapLibre via PMTiles                    |
| `output/_build/geometries.fgb`       | removed_or_ephemeral | temporary Tippecanoe input removed after pmtiles generation     |
| `output/_build/unmatched.fgb`        | removed_or_ephemeral | temporary Tippecanoe input removed after pmtiles generation     |
| `output/_build/`                     | removed_or_ephemeral | build staging directory is cleaned up after run                 |
| `output/comparison_for_report.json`  | removed_or_ephemeral | legacy output deleted when present                              |
| `output/detailed_results.csv`        | removed_or_ephemeral | legacy output deleted when present                              |
| `output/comparison_report.md`        | removed_or_ephemeral | legacy output deleted when present                              |

## Action rules from static snapshot copy step

| Pattern                                 | Behavior             | Why                                                               |
| --------------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `snapshots.json`                        | copied_to_public     | loaded by area route snapshots query                              |
| `output/comparison.pmtiles`             | copied_to_public     | map source for comparison layer                                   |
| `output/unmatched.pmtiles`              | copied_to_public     | map source for unmatched layer                                    |
| `output/comparison_table.json`          | copied_to_public     | primary area payload fetched by report                            |
| `output/unmatched.json`                 | copied_to_public     | unmatched payload fetched by report                               |
| `output/features/`                      | copied_to_public     | feature route payload shards                                      |
| `output/official_for_edit/`             | copied_to_public     | downloadable official geometries referenced by rows               |
| `data/processing-state.json`            | copied_to_public     | status page processing summary input                              |
| `data/processing-log.jsonl`             | copied_to_public     | status page log stream input                                      |
| `everything else under datasets/<area>` | not_copied_to_public | prepareStaticSnapshot copies only explicit allowlisted files/dirs |

## Public snapshot footprint (`report/public`)

- Datasets files: **34360** (3066.53 MiB)
- Data files: **2** (0.01 MiB)

Largest public dataset files:

- `report/public/datasets/de-gemeinden/output/comparison.pmtiles` - 227.37 MiB (238416599 bytes)
- `report/public/datasets/de-laender/output/unmatched.pmtiles` - 144.99 MiB (152029608 bytes)
- `report/public/datasets/de-verwaltungsgemeinschaften/output/comparison.pmtiles` - 128.33 MiB (134566835 bytes)
- `report/public/datasets/de-regierungsbezirke/output/unmatched.pmtiles` - 122.41 MiB (128354096 bytes)
- `report/public/datasets/de-verwaltungsgemeinschaften/output/unmatched.pmtiles` - 119.05 MiB (124828429 bytes)
- `report/public/datasets/de-landkreise/output/unmatched.pmtiles` - 118.66 MiB (124428864 bytes)
- `report/public/datasets/de-landkreise/output/comparison.pmtiles` - 62.11 MiB (65125297 bytes)
- `report/public/datasets/de-gemeinden/output/unmatched.pmtiles` - 58.36 MiB (61195864 bytes)
- `report/public/datasets/de-laender/output/comparison.pmtiles` - 21.39 MiB (22425358 bytes)
- `report/public/datasets/brandenburg-berlin-plz/output/comparison.pmtiles` - 16.50 MiB (17301758 bytes)
- `report/public/datasets/de-staat/output/official_for_edit/514770000000.geojson` - 16.12 MiB (16900336 bytes)
- `report/public/datasets/de-gemeinden/output/comparison_table.json` - 15.03 MiB (15756203 bytes)
- `report/public/datasets/brandenburg-gemeinden/output/comparison.pmtiles` - 14.75 MiB (15470117 bytes)
- `report/public/datasets/de-regierungsbezirke/output/comparison.pmtiles` - 12.15 MiB (12740139 bytes)
- `report/public/datasets/de-laender/output/official_for_edit/090000000000.geojson` - 10.14 MiB (10631173 bytes)
- `report/public/datasets/de-verwaltungsgemeinschaften/output/comparison_table.json` - 7.91 MiB (8299238 bytes)

## Built static artifact footprint (`report/dist`)

- Files: **33994**
- Size: **3186.25 MiB**

## User-facing route load estimates

These estimates use file size on disk. Real transfer can be lower due to compression; PMTiles is range-requested.

### Shared routes

#### `/`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- Route estimate total: **0.00 MiB (5014 bytes)**

#### `/status`

- processing-state (public first, runtime fallback): `report/public/data/processing-state.json` - 0.00 MiB (272 bytes)
- processing-log (public first, runtime fallback): `report/public/data/processing-log.jsonl` - 0.00 MiB (5119 bytes)
- Route estimate total: **0.01 MiB (5391 bytes)**

### Dataset `berlin-bezirke` (public snapshot)

#### `/berlin-bezirke`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/berlin-bezirke/output/comparison_table.json` - 0.01 MiB (12609 bytes)
- snapshots: `report/public/datasets/berlin-bezirke/snapshots.json` - 0.00 MiB (622 bytes)
- comparison pmtiles (range requested): `report/public/datasets/berlin-bezirke/output/comparison.pmtiles` - 0.65 MiB (685463 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/berlin-bezirke/output/unmatched.pmtiles` - 0.92 MiB (959912 bytes)
- Route estimate total: **1.59 MiB (1663620 bytes)**

#### `/berlin-bezirke/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/berlin-bezirke/output/features/11000004.json` - 0.00 MiB (2328 bytes)
- comparison fallback payload: `report/public/datasets/berlin-bezirke/output/comparison_table.json` - 0.01 MiB (12609 bytes)
- Route estimate total (largest shard + fallback upper bound): **0.02 MiB (19951 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/berlin-bezirke/output/features/11000012.json` - 0.00 MiB (2316 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (7330 bytes)**

### Dataset `de-staat` (public snapshot)

#### `/de-staat`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/de-staat/output/comparison_table.json` - 0.00 MiB (2434 bytes)
- snapshots: `report/public/datasets/de-staat/snapshots.json` - 0.00 MiB (408 bytes)
- comparison pmtiles (range requested): `report/public/datasets/de-staat/output/comparison.pmtiles` - 6.84 MiB (7174164 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/de-staat/output/unmatched.pmtiles` - missing
- Route estimate total: **6.85 MiB (7182020 bytes)**

#### `/de-staat/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/de-staat/output/features/514770000000.json` - 0.00 MiB (2434 bytes)
- comparison fallback payload: `report/public/datasets/de-staat/output/comparison_table.json` - 0.00 MiB (2434 bytes)
- Route estimate total (largest shard + fallback upper bound): **0.01 MiB (9882 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/de-staat/output/features/514770000000.json` - 0.00 MiB (2434 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (7448 bytes)**

### Dataset `de-gemeinden` (public snapshot)

#### `/de-gemeinden`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/de-gemeinden/output/comparison_table.json` - 15.03 MiB (15756203 bytes)
- snapshots: `report/public/datasets/de-gemeinden/snapshots.json` - 0.00 MiB (263 bytes)
- comparison pmtiles (range requested): `report/public/datasets/de-gemeinden/output/comparison.pmtiles` - 227.37 MiB (238416599 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/de-gemeinden/output/unmatched.pmtiles` - 58.36 MiB (61195864 bytes)
- Route estimate total: **300.76 MiB (315373943 bytes)**

#### `/de-gemeinden/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/de-gemeinden/output/features/071385004068.json` - 0.00 MiB (2660 bytes)
- comparison fallback payload: `report/public/datasets/de-gemeinden/output/comparison_table.json` - 15.03 MiB (15756203 bytes)
- Route estimate total (largest shard + fallback upper bound): **15.03 MiB (15763877 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/de-gemeinden/output/features/073315001001.json` - 0.00 MiB (2617 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (7631 bytes)**

### Dataset `berlin-ortsteile` (public snapshot)

#### `/berlin-ortsteile`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/berlin-ortsteile/output/comparison_table.json` - 0.06 MiB (66614 bytes)
- snapshots: `report/public/datasets/berlin-ortsteile/snapshots.json` - 0.00 MiB (403 bytes)
- comparison pmtiles (range requested): `report/public/datasets/berlin-ortsteile/output/comparison.pmtiles` - 0.67 MiB (697789 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/berlin-ortsteile/output/unmatched.pmtiles` - 1.08 MiB (1128273 bytes)
- Route estimate total: **1.81 MiB (1898093 bytes)**

#### `/berlin-ortsteile/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/berlin-ortsteile/output/features/110000030306.json` - 0.00 MiB (1942 bytes)
- comparison fallback payload: `report/public/datasets/berlin-ortsteile/output/comparison_table.json` - 0.06 MiB (66614 bytes)
- Route estimate total (largest shard + fallback upper bound): **0.07 MiB (73570 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/berlin-ortsteile/output/features/110000070704.json` - 0.00 MiB (1930 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (6944 bytes)**

### Dataset `hamburg-bezirke` (public snapshot)

#### `/hamburg-bezirke`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/hamburg-bezirke/output/comparison_table.json` - 0.05 MiB (48965 bytes)
- snapshots: `report/public/datasets/hamburg-bezirke/snapshots.json` - 0.00 MiB (400 bytes)
- comparison pmtiles (range requested): `report/public/datasets/hamburg-bezirke/output/comparison.pmtiles` - 0.26 MiB (271123 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/hamburg-bezirke/output/unmatched.pmtiles` - 0.15 MiB (158718 bytes)
- Route estimate total: **0.46 MiB (484220 bytes)**

#### `/hamburg-bezirke/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/hamburg-bezirke/output/features/020000000001.json` - 0.01 MiB (7769 bytes)
- comparison fallback payload: `report/public/datasets/hamburg-bezirke/output/comparison_table.json` - 0.05 MiB (48965 bytes)
- Route estimate total (largest shard + fallback upper bound): **0.06 MiB (61748 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/hamburg-bezirke/output/features/020000000002.json` - 0.01 MiB (7741 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (12755 bytes)**

### Dataset `brandenburg-gemeinden` (public snapshot)

#### `/brandenburg-gemeinden`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/brandenburg-gemeinden/output/comparison_table.json` - 0.52 MiB (541098 bytes)
- snapshots: `report/public/datasets/brandenburg-gemeinden/snapshots.json` - 0.00 MiB (633 bytes)
- comparison pmtiles (range requested): `report/public/datasets/brandenburg-gemeinden/output/comparison.pmtiles` - 14.75 MiB (15470117 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/brandenburg-gemeinden/output/unmatched.pmtiles` - 4.60 MiB (4821109 bytes)
- Route estimate total: **19.87 MiB (20837971 bytes)**

#### `/brandenburg-gemeinden/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/brandenburg-gemeinden/output/features/12061005.json` - 0.00 MiB (2734 bytes)
- comparison fallback payload: `report/public/datasets/brandenburg-gemeinden/output/comparison_table.json` - 0.52 MiB (541098 bytes)
- Route estimate total (largest shard + fallback upper bound): **0.52 MiB (548846 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/brandenburg-gemeinden/output/features/12067288.json` - 0.00 MiB (2544 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (7558 bytes)**

### Dataset `de-verwaltungsgemeinschaften` (public snapshot)

#### `/de-verwaltungsgemeinschaften`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/de-verwaltungsgemeinschaften/output/comparison_table.json` - 7.91 MiB (8299238 bytes)
- snapshots: `report/public/datasets/de-verwaltungsgemeinschaften/snapshots.json` - 0.00 MiB (278 bytes)
- comparison pmtiles (range requested): `report/public/datasets/de-verwaltungsgemeinschaften/output/comparison.pmtiles` - 128.33 MiB (134566835 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/de-verwaltungsgemeinschaften/output/unmatched.pmtiles` - 119.05 MiB (124828429 bytes)
- Route estimate total: **255.30 MiB (267699794 bytes)**

#### `/de-verwaltungsgemeinschaften/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/de-verwaltungsgemeinschaften/output/features/145235122000.json` - 0.00 MiB (2417 bytes)
- comparison fallback payload: `report/public/datasets/de-verwaltungsgemeinschaften/output/comparison_table.json` - 7.91 MiB (8299238 bytes)
- Route estimate total (largest shard + fallback upper bound): **7.92 MiB (8306669 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/de-verwaltungsgemeinschaften/output/features/066340003000.json` - 0.00 MiB (2085 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (7099 bytes)**

### Dataset `berlin-plz` (public snapshot)

#### `/berlin-plz`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/berlin-plz/output/comparison_table.json` - 0.15 MiB (153225 bytes)
- snapshots: `report/public/datasets/berlin-plz/snapshots.json` - 0.00 MiB (254 bytes)
- comparison pmtiles (range requested): `report/public/datasets/berlin-plz/output/comparison.pmtiles` - 2.41 MiB (2525169 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/berlin-plz/output/unmatched.pmtiles` - missing
- Route estimate total: **2.56 MiB (2683662 bytes)**

#### `/berlin-plz/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/berlin-plz/output/features/13349.json` - 0.00 MiB (1507 bytes)
- comparison fallback payload: `report/public/datasets/berlin-plz/output/comparison_table.json` - 0.15 MiB (153225 bytes)
- Route estimate total (largest shard + fallback upper bound): **0.15 MiB (159746 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/berlin-plz/output/features/10961.json` - 0.00 MiB (1501 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (6515 bytes)**

### Dataset `brandenburg-berlin-plz` (public snapshot)

#### `/brandenburg-berlin-plz`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/brandenburg-berlin-plz/output/comparison_table.json` - 0.30 MiB (309858 bytes)
- snapshots: `report/public/datasets/brandenburg-berlin-plz/snapshots.json` - 0.00 MiB (630 bytes)
- comparison pmtiles (range requested): `report/public/datasets/brandenburg-berlin-plz/output/comparison.pmtiles` - 16.50 MiB (17301758 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/brandenburg-berlin-plz/output/unmatched.pmtiles` - 0.02 MiB (24596 bytes)
- Route estimate total: **16.82 MiB (17641856 bytes)**

#### `/brandenburg-berlin-plz/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/brandenburg-berlin-plz/output/features/16356.json` - 0.00 MiB (1616 bytes)
- comparison fallback payload: `report/public/datasets/brandenburg-berlin-plz/output/comparison_table.json` - 0.30 MiB (309858 bytes)
- Route estimate total (largest shard + fallback upper bound): **0.30 MiB (316488 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/brandenburg-berlin-plz/output/features/16835.json` - 0.00 MiB (1596 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (6610 bytes)**

### Dataset `de-regierungsbezirke` (public snapshot)

#### `/de-regierungsbezirke`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/de-regierungsbezirke/output/comparison_table.json` - 2.98 MiB (3125806 bytes)
- snapshots: `report/public/datasets/de-regierungsbezirke/snapshots.json` - 0.00 MiB (266 bytes)
- comparison pmtiles (range requested): `report/public/datasets/de-regierungsbezirke/output/comparison.pmtiles` - 12.15 MiB (12740139 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/de-regierungsbezirke/output/unmatched.pmtiles` - 122.41 MiB (128354096 bytes)
- Route estimate total: **137.54 MiB (144225321 bytes)**

#### `/de-regierungsbezirke/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/de-regierungsbezirke/output/features/094000000000.json` - 0.00 MiB (2329 bytes)
- comparison fallback payload: `report/public/datasets/de-regierungsbezirke/output/comparison_table.json` - 2.98 MiB (3125806 bytes)
- Route estimate total (largest shard + fallback upper bound): **2.99 MiB (3133149 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/de-regierungsbezirke/output/features/057000000000.json` - 0.00 MiB (2315 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (7329 bytes)**

### Dataset `de-landkreise` (public snapshot)

#### `/de-landkreise`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/de-landkreise/output/comparison_table.json` - 3.39 MiB (3557373 bytes)
- snapshots: `report/public/datasets/de-landkreise/snapshots.json` - 0.00 MiB (261 bytes)
- comparison pmtiles (range requested): `report/public/datasets/de-landkreise/output/comparison.pmtiles` - 62.11 MiB (65125297 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/de-landkreise/output/unmatched.pmtiles` - 118.66 MiB (124428864 bytes)
- Route estimate total: **184.17 MiB (193116809 bytes)**

#### `/de-landkreise/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/de-landkreise/output/features/120510000000.json` - 0.00 MiB (2589 bytes)
- comparison fallback payload: `report/public/datasets/de-landkreise/output/comparison_table.json` - 3.39 MiB (3557373 bytes)
- Route estimate total (largest shard + fallback upper bound): **3.40 MiB (3564976 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/de-landkreise/output/features/095620000000.json` - 0.00 MiB (2552 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (7566 bytes)**

### Dataset `de-laender` (public snapshot)

#### `/de-laender`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- comparison table: `report/public/datasets/de-laender/output/comparison_table.json` - 2.98 MiB (3124248 bytes)
- snapshots: `report/public/datasets/de-laender/snapshots.json` - 0.00 MiB (439 bytes)
- comparison pmtiles (range requested): `report/public/datasets/de-laender/output/comparison.pmtiles` - 21.39 MiB (22425358 bytes)
- unmatched pmtiles (range requested): `report/public/datasets/de-laender/output/unmatched.pmtiles` - 144.99 MiB (152029608 bytes)
- Route estimate total: **169.36 MiB (177584667 bytes)**

#### `/de-laender/feature/{featureKey}`

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- largest feature shard: `report/public/datasets/de-laender/output/features/070000000000.json` - 0.00 MiB (2393 bytes)
- comparison fallback payload: `report/public/datasets/de-laender/output/comparison_table.json` - 2.98 MiB (3124248 bytes)
- Route estimate total (largest shard + fallback upper bound): **2.99 MiB (3131655 bytes)**

- areas index: `areas.gen.json` - 0.00 MiB (5014 bytes)
- median feature shard: `report/public/datasets/de-laender/output/features/080000000000.json` - 0.00 MiB (2347 bytes)
- Route estimate total (median shard, no fallback): **0.01 MiB (7361 bytes)**
