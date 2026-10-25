# Plan: protected areas (Digitize the Planet) vs. OSM

Status: local v1 implemented (steps 1–6), not committed; CI wiring (step 7) open. Facts checked against the DtP API v2.2.0 on 2026-10-25.

Goal: compare the protected-area geometries that Digitize the Planet e.V. (DtP) collects with OSM, using the same pattern as the admin datasets: one strong reference key, extra attribute checks on matched rows, and a broader candidate search for `official_only` rows. The candidate search exists to get `ref:WDPA` added in OSM.

## 1. Source: DtP API v2

- Base `https://platform.digitizetheplanet.org/api/v2`, no key, no rate limit, fair use (cache, use `fields`). Terms: `termsOfService` in `/schema` → digitizetheplanet.org/nutzungsbedingungen (VII.2 allows them to restrict automated bulk queries).
- License: CC0 by default, but every geometry carries its own `geodata.license` and `geodata.source` (22 licenses in use, incl. CC BY-ND 4.0, GeoNutzV, `otherRestriction`).
- `/protected-areas?country_id=1&fields=all`: 5,183 managed areas by default; with `include_unmanaged=true` 24,663 (unmanaged areas have geometries too, just no rules maintained by an administration). 50 per page (fixed) → 494 pages. The sync uses `include_unmanaged=true`. Returns `uuid`, `category_id`, `name`, `external_references`, `updated_at`, `area_in_km2`, **no geometry**.
- `/protected-areas/{uuid}?fields=geodata`: MultiPolygon (EPSG:4326, 7 decimals), centroid, source, license. ~1.7 KB–large, ~0.1 s per request.
- `/protected-areas/deleted?deleted_after=YYYY-MM-DD`: deletions (3 in the last 30 days).
- `updated_after` / `created_after` filters exist (UTC day granularity).
- No bulk export, no `ETag` / `Last-Modified`, gzip works.

Change rate from `updated_at` in the 2026-10-25 list: 65 records changed in the last 7 days, but 3,035 in September 2026 alone (a bulk update). We cannot tell from the API whether `updated_at` moves when only rules change, or whether a geometry change always moves it.

Reference coverage (DtP, Germany):

| DtP category                                          | Areas | `wdpa` | `osm` ref |
| ----------------------------------------------------- | ----- | ------ | --------- |
| Naturschutzgebiet                                     | 3,583 | 3,400  | 1,303     |
| Landschaftsschutzgebiet                               | 424   | 392    | 18        |
| FFH-Gebiet                                            | 324   | 324    | 5         |
| Vogelschutzgebiet                                     | 43    | 42     | 2         |
| Naturpark                                             | 50    | 6      | 14        |
| Nationalpark                                          | 13    | 13     | 13        |
| Biosphärenreservat                                    | 12    | 11     | 7         |
| Wald-Wild-Schongebiet, Wildschutzgebiet, Ruhezonen, … | ~700  | 0      | ~400      |

Caveats: the counts above come from a first list sweep with the default order, which is unstable (see section 2) and returned ~30 duplicate items. The complete harvest of 2026-10-25 has 4,195 areas with a WDPA id and no WDPA id occurs twice. DtP holds only a part of the German LSG (424). FFH/Vogelschutz `source_id` is the Natura 2000 site code (`DE5519304`). State `source_id` (`bw_4.322`) does not match the OSM `ref:DE-BW` scheme (`82150840001`).

## 2. Incremental sync (instead of 5,183 requests per run)

Yes, a delta sync with a persisted cache is the way to always have a full, current dataset. Design:

1. **Inventory sweep every run:** all 104 list pages (~1 min). The default list order is not stable (259 areas share one `created_at`), so pages overlap and areas go missing; the sweep uses `ordering=area_in_km2` and falls back to a second sweep with `-area_in_km2` if the count is short. If it is still short, cached records are not pruned in that run. The detail endpoint does not accept `uuid` in `fields`. This is the source of truth for which uuids exist, plus `updated_at`, `area_in_km2`, references and category. It catches new and removed areas without relying on `updated_after` day boundaries.
2. **Detail fetch only where needed:**
   - new uuid,
   - `updated_at` changed,
   - `area_in_km2` changed (cheap geometry fingerprint in case `updated_at` misses a geometry edit),
   - rolling re-verify: records whose `fetchedAt` is older than 28 days, at most ~200 per run.
3. **Remove** uuids missing from the inventory; cross-check with `/protected-areas/deleted`.
4. **Cap** detail fetches per run (e.g. 1,500) with a small pause, so a bulk update like September 2026 spreads over 2–3 runs instead of blowing up the job. Record `pendingDetailCount` in metadata so the report can show "partially stale".
5. **Build** the per-dataset `official.fgb` files from the cache (one shared download for all protected-area datasets, like the shared BKG ZIP).

Cache format: `.cache/dtp/inventory.json` (list sweep) + `.cache/dtp/areas.ndjson.gz` (one detail record per line, with `fetchedAt`) + `.cache/dtp/download-metadata.json` (`sourceUpdatedAt` = max `updated_at`, `sourceUpdatedAtVerifiedAt`, `downloadedAt`, counts).

Persisting across GitHub runs: use the existing last-good artifact pattern (`dawidd6/action-download-artifact` from the last successful run, as for `source-cache-official-last-good`). Add a scope `source-cache-dtp` to the cache policy (keep: the three cache files above). `actions/cache` would also work but is evicted after 7 days without access and is less visible in the run summary.

Bootstrap: first full harvest once, via `workflow_dispatch` or locally, then upload as the first artifact. With ~0.1 s per request plus a 0.2 s pause, a full harvest takes ~25 minutes, not 1.5 hours. A routine run should be ~1–3 minutes.

If the artifact is missing (expired, first run on a fork): fall back to a full harvest under the cap and mark the datasets as incomplete until the next runs fill it.

## 3. Datasets

**Decided 2026-10-25: four datasets.** The local v1 with one dataset only held the 5,183 "managed" DtP areas (API default). With `include_unmanaged=true` DtP has 24,663 areas in Germany; ~95 % of the former "OSM only" rows were unmanaged DtP areas. One dataset with ~23,000 rows would be ~15 MB and overlap heavily, so:

| Dataset                 | DtP categories                                    | Areas with WDPA                                |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `de-schutzgebiete-nsg`  | 2 Naturschutzgebiet, 50 Nationales Naturmonument  | ~8,700                                         |
| `de-schutzgebiete-lsg`  | 5 Landschaftsschutzgebiet                         | ~9,140                                         |
| `de-natura2000`         | 7 FFH-Gebiet, 8 Vogelschutzgebiet                 | ~5,220                                         |
| `de-grossschutzgebiete` | 1 Nationalpark, 3 Biosphärenreservat, 4 Naturpark | ~40 (only 14 of 105 Naturparks have a WDPA id) |

Out of scope: Wald-Wild-Schongebiete, Wildschutzgebiete, Ruhezonen and other zones (~450, no WDPA id; possible later as a dataset keyed on the DtP OSM reference / OSM `dtp_id`).

The reasoning below is the earlier discussion that led to this split.

As few datasets as possible; split only where the comparison itself differs.

**Things that do _not_ require a split:**

- Different tag rules per type. The category is a property of each official row, so tag suggestions and the type scope for candidates are a lookup table per category, applied per row.
- Size. ~4,400 rows fit; a Germany-wide Gemeinden dataset with ~11,000 rows already worked.
- `metricsCrs` (EPSG:25832 for all of Germany) and the WDPA key (unique per site across all categories).

**Things that do require a split:**

- **Match mode** is one per dataset (`osm.matchCriteria`: `property` or `relation_id`). Naturparks have a WDPA id at DtP for only 6 of 50 areas and must match on the DtP `osm` ref instead.
- **Another reference system and possible source swap:** Natura 2000 (FFH, Vogelschutz) also has the EU site code (`DE5519304`, OSM `ref:SCI` / `ref:natura2000`) as a second key, and the EEA publishes the original geometries. If we switch that part to EEA later, it is a separate source anyway.
- **Overlap inside one dataset:** Natura 2000 sites largely cover the same land as NSG/LSG. In one dataset the map would show the same place two or three times with different rows. National designations also overlap (NSG inside LSG inside Biosphärenreservat), but less, and that is acceptable with a category filter.

**First local version: one dataset.** `de-schutzgebiete` holds every DtP area with a WDPA id (NSG, LSG, Nationalpark, Biosphärenreservat, Nationales Naturmonument, FFH, Vogelschutz, and the 6 Naturparks that have one), about 4,190 rows. This lets us see the overlap problems in practice before we decide. DtP areas without a WDPA id (44 Naturparks, Wald-Wild-Schongebiete, …) are left out of v1, because the dataset can only use one match mode.

**Before the first publication** we decide on the split below, based on what the local version shows.

**Possible split: three datasets.**

| Dataset            | DtP categories                                                                                         | Rows   | Strong key                              | Why separate                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ------ | --------------------------------------- | -------------------------------------------------------------------------- |
| `de-schutzgebiete` | Naturschutzgebiet, Landschaftsschutzgebiet, Nationalpark, Biosphärenreservat, Nationales Naturmonument | ~4,030 | `ref:WDPA`                              | base dataset                                                               |
| `de-natura2000`    | FFH-Gebiet, Vogelschutzgebiet                                                                          | ~370   | `ref:WDPA` (site code as candidate key) | second reference system, EEA as possible source, overlaps the base dataset |
| `de-naturparke`    | Naturpark                                                                                              | 50     | DtP `osm` ref (`relation_id`)           | other match mode                                                           |

If `de-natura2000` stays on DtP and the overlap is acceptable to you, it can merge into `de-schutzgebiete`; it is the weakest of the two splits. `de-naturparke` can merge as soon as OSM and DtP carry WDPA ids for Naturparks (then the candidate search would suggest them).

Per-category rules inside a dataset (type scope for `unmatchedOsm` and candidates, expected tags for suggestions):

| Category                | Expected OSM tags (suggestion)                                                                               | Type scope                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Nationalpark            | `boundary=national_park`, `protect_class=2`                                                                  | `boundary=national_park` or `protect_class=2`                                         |
| Naturschutzgebiet       | `boundary=protected_area`, `leisure=nature_reserve`, `protect_class=4`, `protection_title=Naturschutzgebiet` | `protection_title=Naturschutzgebiet` or `protect_class=4` or `leisure=nature_reserve` |
| Biosphärenreservat      | `boundary=protected_area`, `protect_class=98`, `protection_title=Biosphärenreservat`                         | `protect_class=98` or `protection_title~Biosphärenreservat`                           |
| Landschaftsschutzgebiet | `boundary=protected_area`, `protect_class=5`, `protection_title=Landschaftsschutzgebiet`                     | `protection_title=Landschaftsschutzgebiet` or `protect_class=5`                       |
| FFH-Gebiet              | `boundary=protected_area`, `protect_class=97`, `protection_title=FFH-Gebiet`, `ref:SCI`                      | `protect_class=97` or `protection_title~FFH/Fauna-Flora-Habitat`                      |
| Vogelschutzgebiet       | `boundary=protected_area`, `protect_class=97`, `protection_title=Vogelschutzgebiet`, `ref:SPA`?              | `protect_class=97` or `protection_title~Vogelschutz`                                  |
| Naturpark               | `boundary=protected_area`, `protect_class=5`, `protection_title=Naturpark`                                   | `protection_title=Naturpark`                                                          |

The exact `protection_title` values and the Natura 2000 ref keys must be checked against the wiki and taginfo before they become suggestions. The area report gets no category column or filter: filtering is done through separate datasets (the split decision above); the category shows on the feature detail page.

The Wald-Wild-Schongebiete and similar categories have no WDPA id; they are out of scope for now (possible later as a fourth dataset with the DtP `osm` ref as identity key, like `de-naturparke`).

Reports must say "compared with the DtP holdings", not "all NSG in Germany", because DtP coverage is incomplete (especially LSG).

## 4. OSM side

New shared extract, built from the same Germany PBF:

- `osmium tags-filter` on `nwr/boundary=protected_area nwr/boundary=national_park nwr/leisure=nature_reserve nwr/protect_class nwr/protection_title` (19 MB from the 2026-08-31 PBF; 3,708 relations, 14,070 closed ways carry the tags).
- `germany-protected-areas-wdpa.fgb`: polygons with `ref:WDPA` set (7,132 objects today). Columns: `name`, `ref:WDPA`, `wikidata`, `boundary`, `leisure`, `protect_class`, `protection_title`, `ref:SCI`, `ref:natura2000`, `ref:DE`, `operator`.
- `germany-protected-areas-candidates.fgb`: points-only (`ST_PointOnSurface`), all protected-area polygons, same columns. Same reasoning as the admin candidates FGB in `official-only-candidate-matching.md`.
- New `osmProfile` `protected_area_wdpa` in `scripts/shared/osmProfiles.ts`, `matchProperty: 'ref:WDPA'`, like `postal_code`.
- New id normalization preset `wdpa`: trim, digits only. `ref:WDPA` with several values (`;`, 6 objects today) is not split for the strong join; it gets an issue flag instead.
- Type scope (category table above) as a post-match filter, like `osm.adminLevels`: key matching runs first, so an NSG with a wrong `protection_title` still matches and gets an attribute hint instead. For `unmatchedOsm` the scope is the union over the dataset's categories; for candidates it is the scope of the row's own category.

## 5. Compare: strong match, attribute checks, candidates

**Strong match:** DtP `external_references.wdpa` ↔ OSM `ref:WDPA` after the `wdpa` preset. Several DtP areas with the same WDPA id: keep the one whose category matches the dataset; if still several, union (existing `geoMerge`) and flag. Metrics as today (IoU, area delta, Hausdorff).

**Attribute checks on matched rows** (suggestions, not failures):

- type tags fit the category (`protection_title`, `protect_class`, `boundary=national_park`),
- `wikidata` missing in OSM while DtP has one, or different,
- DtP `osm` ref points to a different OSM object than the matched one,
- Natura 2000: DtP site code missing in OSM `ref:SCI` / `ref:natura2000`.

**Candidates for `official_only` rows** (goal: add `ref:WDPA`). The general attribute is the **type scope plus location**, the same role `admin_level` plays for admin boundaries. Ranking signals, strongest first:

1. DtP `osm` ref names this OSM object (1,303 NSG already carry one),
2. same `wikidata`,
3. Natura 2000 site code equal (`source_id` ↔ `ref:SCI` / `ref:natura2000`),
4. point inside the shrunk DtP polygon (existing `candidateShrinkFactor` logic) and type scope fits,
5. name similarity (normalized, without "NSG"/"LSG" prefixes).

Drop candidates whose `ref:WDPA` already matches another official row. Each candidate gets a concrete suggestion "add `ref:WDPA=<id>`" (and `wikidata` if missing) with the existing iD / osm.org links.

**`unmatchedOsm`:** OSM objects with `ref:WDPA` in the type scope whose id is not in DtP. Shown as information ("not in DtP"), since DtP is incomplete.

## 6. License per geometry

Today the license is one block per dataset: `official.licenseId`, `licenseLabel`, `licenseSourceUrl`, `osmCompatibility` (`unknown | no | yes_licence | yes_waiver`), `osmCompatibilitySourceUrl` and `osmCompatibilityComment` in `source/metadata.json` (`scripts/shared/sourceMetadata.ts`). The report shows it in `ReportLicenseCompatibilitySection` and in the home license table. The edit download (`officialForEditPath`) is not tied to the license.

DtP has one license per geometry, so we extend the model with an optional row-level license. The rule stays as for the other datasets: **always offer everything** (map, download, iD/JOSM links), and show a notice when the license does not fit OSM, saying that another source or a release (Freigabe) is needed.

**Data model:**

- New optional `officialLicense` per row in `comparison_table.json` and the feature shards, with the same fields as the dataset block plus the geometry source: `licenseId`, `licenseLabel`, `licenseSourceUrl`, `osmCompatibility`, `osmCompatibilitySourceUrl`, `osmCompatibilityComment`, `sourceName`, `sourceUrl`.
- The dataset block stays. For DtP it describes the API (CC0 for the non-geometry data) and gets a new `licenseId: 'mixed'` with `licenseLabel` "Pro Gebiet unterschiedlich". Its `osmCompatibility` is derived from the rows: `yes_*` if all rows are compatible, `no` if none is, otherwise a new value `partial` ("Teilweise").
- New `licenseBreakdown` in the dataset's `sourceMetadata` (written at compare time, embedded in `comparison_table.json` and in the areas index): one entry per **geometry source × license**, with `sourceName`, `sourceUrl`, `licenseId`, `licenseLabel`, `licenseSourceUrl`, `osmCompatibility`, `osmCompatibilitySourceUrl`, `osmCompatibilityComment`, `ruleId` (which entry of the compatibility table applied) and `rowCount`. Datasets with one license have no breakdown.
- One resolver, `resolveRowLicense(row, sourceMetadata)`: row license if present, otherwise the dataset license. All UI parts read the license only through it, so existing datasets do not change.
- Extend `datasetLicenseIdSchema` with the licenses that occur often at DtP: `cc_by_sa_40`, `cc_by_nd_40`, `geonutzv`, `other_restriction`, `mixed`. Rare ones map to `custom` with the original label.

**Compatibility assessment:** DtP only says which license applies, not whether it fits OSM. We keep our own reviewed table in git, `data/license-compatibility/dtp.json`. It has two levels:

- **Per license** (default rule), e.g. "CC0 1.0 → `yes_licence`".
- **Per geometry source** (override), e.g. "LfU Bayern, CC BY 4.0 → `yes_waiver`, evidence: DE:Permissions, signed PDF 2022-10-19". This level matters most, because a release (Freigabe) is given by a data holder (Behörde), not by a license.

Each entry has an `id`, `osmCompatibility`, an evidence URL, a comment and a `decidedAt` date. When a new release arrives, we add one source override; on the next compare run all rows of that source switch to compatible, and the overview and the home summary update without code changes. This is the path to "eventually everything released". Defaults:

| DtP license                                        | `osmCompatibility` default                            |
| -------------------------------------------------- | ----------------------------------------------------- |
| CC0 1.0, Deutschland Zero, DL-DE Zero-2.0          | `yes_licence`                                         |
| ODbL 1.0                                           | `yes_licence`                                         |
| CC BY 4.0, CC BY-SA 4.0, DL-DE BY-2.0              | `no` unless a source override lists a waiver          |
| CC BY-ND 4.0, GeoNutzV, `otherRestriction`, others | `no`                                                  |
| not in the table                                   | `unknown`, and listed in the run summary so we add it |

**UI:**

- Feature detail: the license section shows the row license and the geometry source (read from the feature shard). At the top of "Daten in OSM bearbeiten", for `no` or `unknown`, the notice from the sister project OSM Schulabgleich (orange triangle, linked sentence + "Dieser Abgleich darf daher nur als Basis für eine eigene Recherche genutzt werden."). The buttons stay active.
- **License overview per dataset** (area report, license section, anchor `#report-licence-section`): for datasets with a `licenseBreakdown`, `ReportLicenseCompatibilitySection` shows a summary like the home page and the full table collapsed behind a disclosure (opened by the anchor). One row per geometry source × license:

  | Quelle        | Lizenz       | Gebiete | OSM-kompatibel | Regelung / Nachweis                                |
  | ------------- | ------------ | ------- | -------------- | -------------------------------------------------- |
  | LfU Bayern    | CC BY 4.0    | 312     | Ja (Freigabe)  | Quell-Ausnahme, DE:Permissions, 2022-10-19         |
  | LUBW          | DL-DE BY-2.0 | 1,040   | Nein           | Standardregel DL-DE BY-2.0: keine Freigabe bekannt |
  | UJ Oberallgäu | CC BY-ND 4.0 | 59      | Nein           | Standardregel CC BY-ND 4.0                         |

  (numbers are invented examples.) Above the table, one line: "x von y Gebieten OSM-kompatibel". Sorted by area count, so the most valuable releases are at the top.

- Table rows in `comparison_table.json` carry no license or official/OSM properties for this dataset; everything per area lives in the feature shards. The area table is virtualized (`@tanstack/react-virtual`).
- **Home license table:** stays one row per dataset; the existing merge by source and license tuple is unchanged for all other datasets. A DtP dataset shows "Pro Gebiet unterschiedlich" as license, "Teilweise (x von y Gebieten)" as compatibility, and instead of a single evidence link a link "Lizenzübersicht" to the dataset's license section. Mixed datasets are never merged with other rows.

Adding the `ref:WDPA` id to OSM is a reference, not geometry, and does not depend on the geometry license. The OSM community already uses `ref:WDPA` (7,132 objects).

## 7. Questions for DtP (FOSSGIS AG OSM und Outdoor)

1. Could you offer a bulk export (GeoPackage or GeoJSON ZIP) of all areas with geometry, e.g. weekly? Then we would not need ~5,000 single requests.
2. Does `updated_at` change on every geometry change? Could the list endpoint expose a `geometry_updated_at` or a geometry hash?
3. Is a full harvest about once a month plus small delta fetches several times per week acceptable under the fair-use rule?
4. Could the list endpoint have a stable default order (e.g. by `uuid`)? With the default order, pages overlap and some areas are missing from a full sweep.

Resolved by our own analysis: the 30 "duplicate" WDPA ids came from the unstable list order, not from the data. The full harvest has no duplicate WDPA id.

## 8. Implementation order

1. `scripts/download/dtp.ts`: inventory sweep, delta fetch, cache files, metadata (with unit tests on the cached responses in `.cache/dtp/2026-10-25/`, turned into small committed fixtures).
2. `extract:official` support: build `official.fgb` per dataset from the cache by `category_id`.
3. OSM extract kinds `protected_areas` and `protected_areas_candidates`, profile `protected_area_wdpa`, preset `wdpa`.
4. `de-schutzgebiete` first, limited to the 13 Nationalparks (all with WDPA and OSM ref) to prove the path end to end, then opened to all categories with a WDPA id (local v1). Review the overlaps on the map, then decide on the split (section 3) before the first publication.
5. Row-level license: `officialLicense` field, `resolveRowLicense`, compatibility table with source overrides, `licenseBreakdown`, license overview in the area report, home row for mixed datasets, UI notices (section 6). Needed before the pilot is published.
6. Candidate ranking signals and attribute checks (extend `matchCandidates.ts`).
7. CI: `source-cache-dtp` artifact scope, bootstrap via `workflow_dispatch`, cache-policy doc.
