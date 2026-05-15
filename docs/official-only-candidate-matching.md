# Official-only candidate matching

Additive compare phase that surfaces OSM features which _could_ fill an `official_only`
row but did not key-match in this area. Strictly informational — the strong key-based
join (`runCompare`) is unchanged; candidate suggestions live next to the row on the
FeatureDetail page so reviewers can resolve missing matches faster without diluting the
match criteria.

Implementation entry points:

- Extract: [`scripts/osm/extract-osm.ts`](../scripts/osm/extract-osm.ts) (`--kind admin_candidates` / `--kind plz_candidates`; nightly pipeline calls these explicitly after `--kind admin`. Locally, `bun run --filter ./scripts extract:osm` without `--kind` defaults to admin + admin_candidates when interactive, with `--yes` / non-TTY, or with explicit `--kind` — see script `--help`.)
- Match: [`scripts/compare/lib/matchCandidates.ts`](../scripts/compare/lib/matchCandidates.ts)
- Wire-in: `match_candidates` phase in [`scripts/compare/lib/compare.ts`](../scripts/compare/lib/compare.ts)
- Persist: per-row shards in [`scripts/compare/lib/writeOutputs.ts`](../scripts/compare/lib/writeOutputs.ts)
- UI: [`report/src/components/featureDetail/OfficialOnlyCandidatesSection.tsx`](../report/src/components/featureDetail/OfficialOnlyCandidatesSection.tsx)

## Why a separate POINTS-only FGB

The strong-match FGBs (`germany-admin-boundaries-rs.fgb`, `germany-postal-code-boundaries.fgb`)
already filter to features whose canonical match key is set. Candidates are exactly
the features that fail that filter, so they cannot reuse those FGBs without weakening
their guarantees. Adding a second pass on the full PBF every nightly is also expensive.

We instead extract two separate POINTS-only FlatGeobufs at extract time:

| FGB                                  | Features | Size    | ogr2ogr time |
| ------------------------------------ | -------- | ------- | ------------ |
| `germany-admin-candidates.fgb`       | 31,369   | ~4.4 MB | ~7.9 s       |
| `germany-postal-code-candidates.fgb` | 8,180    | ~1.1 MB | ~1.7 s       |

Geometry collapses to `ST_PointOnSurface(geometry)` so each row carries one inside point
instead of the full multipolygon — a compromise that costs us per-vertex precision but
lets a single bbox-indexed query against all of Germany run in <5 ms. Disk impact: +5.5 MB
under `.cache/osm/`, dwarfed by the 4.4 GB Germany PBF.

Tag selection (admin):

```sql
SELECT ST_PointOnSurface(geometry) AS geometry,
       osm_id,
       osm_way_id,
       "type",
       "admin_level",
       "name",
       "de:regionalschluessel",
       "de:amtlicher_gemeindeschluessel"
FROM multipolygons
WHERE boundary = 'administrative'
  AND admin_level IN (<union over area configs>)
```

`@id` is **not** stored on candidate points. Compare derives way vs relation from GDAL’s
**`osm_way_id`** (non-empty ⇒ closed-way polygon) vs **`osm_id`** (relation-built polygon);
those fields are mutually exclusive on the `multipolygons` layer when `osm_id=yes` in osmconf
(see GDAL’s default `osmconf.ini` and `scripts/osm/extract-osm.ts`).

## Eligibility rules

For each `official_only` row in an area:

1. Resolve the candidate FGB from `osmProfile`:
   - admin profiles (`admin_rs`, `admin_name`) → admin candidates FGB.
   - `postal_code` profile → PLZ candidates FGB.
2. Apply the area's strict reporting filters: `osm.adminLevels` allowlist (admin only),
   `osm.ignoreRelationIds`, plus `compare.bboxFilter / bboxBufferDegrees`. Candidate matching
   stays stricter than the strong key match: `osm.adminLevels` is only a post-match filter for
   `unmatchedOsm`, but candidate suggestions keep using it to avoid noisy higher-tier hints.
3. Derive each candidate's canonical match key under the area's id normalization preset
   (with the same AGS-first / AGS-from-RS fallback used in `compare.ts → deriveOsmKeyForAgsMode`)
   and **drop** the candidate if its canonical key is already present in `officialMap`. This
   covers two scopes:
   - shape-only OSM features (no `de:*` / `postal_code` set), and
   - `unmatched_osm` features whose key value did not align with any official key in this
     area (typo, wrong digit, lifecycle prefix, …).
4. Spatially confirm: shrink the official polygon to `compare.candidateShrinkFactor`
   (default `0.7` linear ≈ 30 % linear shrink, ≈49 % area shrink) around its centroid via
   `turf.transformScale`, bbox-query an `rbush` over candidate points, then run
   `turf.booleanPointInPolygon` for confirmation.

## Output payload

Candidate data is **only** written into `output/features/<canonicalMatchKey>.json` shards.
The main `output/comparison_table.json` is untouched — the AreaReport always loads it and
should stay slim. Per `CandidateMatch`:

| Field                        | Required         | Why                                                                                |
| ---------------------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `osmType`                    | ✅               | osm.org / iD URL building.                                                         |
| `osmId`                      | ✅               | osm.org / iD URL building.                                                         |
| `name`                       | ✅ (nullable)    | Avoid forcing an Overpass round-trip on every detail open; cost < 25 % of payload. |
| `adminLevel`                 | admin only       | Show whether the candidate sits at the expected tier.                              |
| `deRegionalRaw` / `deAgsRaw` | admin only       | Surfaces "OSM lacks the expected `de:*` tag" or "has a different value".           |
| `postalCodeRaw`              | postal_code only | Same purpose as `de:*Raw`.                                                         |

Dropped: `lon`, `lat`, `bbox`, `@id` — none used by the v1 UI; if v2 wants the geometry,
it can call Overpass-by-id (already wired up via `useFeatureDetailOverpass`).

Estimated size impact (de-gemeinden, 482 official_only × ~0.9 candidates avg):
~50 KB across 10,981 shards (currently 43 MB total → +0.1 %). Worst case
(de-verwaltungsgemeinschaften, 3,414 official_only × ~4 candidates):
~1.5 MB additional in shards, +8 % of the existing 18 MB.

## Performance

Measured on de-gemeinden (heaviest admin case) on an M-class Mac:

| Step                                               | Time                     |
| -------------------------------------------------- | ------------------------ |
| Load candidates FGB                                | ~29 ms (31,369 features) |
| Build rbush over `admin_level=8` subset            | ~4 ms (10,879 items)     |
| Per official_only polygon (shrink + rbush + p-i-p) | ~0.21 ms avg             |
| Total for 482 rows                                 | ~150 ms                  |

Negligible against the existing minute-scale phases. PLZ areas are smaller still
(<30 ms total expected).

## v2 scope

- Render candidate polygons on the FeatureDetail map (currently iD/osm.org links only).
  Reuse `useFeatureDetailOverpass` + Overpass-by-id to fetch geometry on demand.
- Aggregate counts on the AreaReport row (e.g. "3 candidates").
- Optional area-level CLI report listing rows with high-confidence single-candidate hits.
