# Boundary comparison — status (2026-03-29)

This note captures the outcome of a full compare pass over all `berlin-*` and `de-*` area folders, the fixes applied in code, and what is still noisy in the data.

## What was broken and fixed in code

1. **`EPSG:25832` and metrics**  
   All `de-*` areas use `metricsCrs: "EPSG:25832"`. `proj4` did not define that code, so compare crashed with `Could not parse to valid json: EPSG:25832`.  
   **Fix:** register `EPSG:25832` in `scripts/compare/lib/projectGeometry.ts`.

2. **BKG short ARS vs OSM 12-digit `de:regionalschluessel`**  
   VG250 often emits shortened keys (e.g. Länder `11` / `02`, Kreise `01001`), while OSM carries full 12-digit regional keys. Rows appeared as `official_only` / `osm_only` despite describing the same entity.  
   **Fix:** for preset `regional-12`, pad or truncate to 12 digits on **both** official and OSM sides in `scripts/compare/lib/normalizeGermanKey.ts`.

## Match counts after the second full run

Approximate row counts from `output/comparison_table.json`:

| Area                         | Rows  | Matched | Official only | OSM only |
| ---------------------------- | ----- | ------- | ------------- | -------- |
| berlin-bezirke               | 12    | 12      | 0             | 0        |
| de-staat                     | 2     | 1       | 1             | 0        |
| de-laender                   | 16    | 16      | 0             | 0        |
| de-landkreise                | 404   | 400     | 3             | 1        |
| de-regierungsbezirke         | 19    | 19      | 0             | 0        |
| de-verwaltungsgemeinschaften | 4611  | 1185    | 3414          | 12       |
| de-gemeinden                 | 11419 | 10393   | 588           | 438      |

## OSM `ogrWhere` vs BKG (feature counts)

Source: `ogrinfo … -so` on `datasets/<area>/source/official.fgb` (BKG layer) and the shared OSM extract layer `boundaries` after `osm:extract`. Postpass (same SQL predicates + Germany bbox) matches these OSM counts for the **Germany** extract; a raw bbox query on the planet DB can include foreign `admin_level=4` polygons — use Geofabrik-derived extracts as ground truth.

| Area                         | BKG features        | OSM `boundaries` | Notes                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| de-staat                     | `vg25_sta`: 8       | 1                | National border compare is pinned to Germany relation identity (`relation/51477`) via area config; it does not require synthetic RS in the shared extract.                                                                                                                                                  |
| de-laender                   | `vg25_lan`: 26      | 16               | 26 polygons in GPKG; **16** unique match rows after `regional-12` join (full Länder set in OSM).                                                                                                                                                                                                            |
| de-regierungsbezirke         | `vg25_rbz`: 19      | 19               | Aligned.                                                                                                                                                                                                                                                                                                    |
| **de-landkreise**            | `vg25_krs`: **403** | **401**          | **Stadtstaaten:** `ogrWhere` ORs `admin_level=4` where RS matches Kreis-form **LL0000000000** with `SUBSTR` and **Land code** `LL` ∈ {`02`,`11`} (HH/BE; excludes e.g. `09…` Land polygons). 399 `@ al6` + 2. **Remaining gap:** **3** `official_only` keys (see below), **1** `osm_only` → 404 union rows. |
| de-verwaltungsgemeinschaften | `vg25_vwg`: 4599    | 1197             | Most BKG VWG have no `admin_level=7` + RS polygon in OSM.                                                                                                                                                                                                                                                   |
| de-gemeinden                 | `vg25_gem`: 10981   | 10832            | ~149 fewer tagged Gemeinden in extract vs BKG rows.                                                                                                                                                                                                                                                         |
| berlin-bezirke               | ALKIS: 12           | 12               | Aligned.                                                                                                                                                                                                                                                                                                    |

**de-landkreise — remaining `official_only` ARS (no OSM polygon in extract):** `079320000000`, `079350000000`, `109420000000` (mapping / mergers / dissolved units — not Stadtstaaten).

## Residual gaps (not fixed by `osm.extract` alone)

- **de-verwaltungsgemeinschaften** — Most rows stay `official_only` because many BKG units have no corresponding `admin_level=7` boundary with `de:regionalschluessel` in OSM under the current extract. Widening `ogrWhere` risks pulling wrong admin polygons; the productive next steps are OSM mapping coverage checks or a deliberately narrower official subset for QA.

- **de-landkreise** — Stadtstaaten HH/BE are covered by the explicit OR in `datasets/de-landkreise/config.jsonc` (see table above). Remaining `official_only` rows are other ARS (e.g. RP/Saar edge cases); `osm_only` is usually Kreis mergers (e.g. Hanau).

- **de-staat** — One `official_only` row uses a non-numeric match key (`--`), i.e. bad/empty ARS in the official file; national-border matching is now configured by OSM relation identity instead of synthetic `000000000000`.

- **de-gemeinden** — ~1k unmatched rows mix missing OSM tags, `admin_level=8` coverage gaps, and edge cases (names, dissolved municipalities, etc.). Expect ongoing drift; the compare pipeline is behaving as designed.

## Commands used at repo root

- Compare one area: `CI=1 bun run run.ts --area <folder>`
- Compare all discoverable areas: `CI=1 bun run run.ts --all`
- Same compare entrypoint via workspace: `bun run compare:boundaries -- --area <folder>`
- Regenerate OSM FlatGeobuf only (after PBF is present): `bun run extract-osm`

## Report app

- Typecheck: `bunx tsc --noEmit -p report/tsconfig.json`
- Build: `bun run report:build`
- Dev/preview server: `bun run report:dev`
