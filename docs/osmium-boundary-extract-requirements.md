# Requirements: Nightly OSM Boundary Extract (Tilda Geo)

## Goal

Generate one canonical OSM administrative-boundary extract once per night in Tilda Geo, so downstream compare jobs can reliably match official boundaries against OSM.

## Scope

- In scope: extract from Germany OSM PBF, boundary filtering, output schema/format, scheduling, and quality checks.
- Out of scope: per-area compare logic and report rendering.

## Source Input

- **Primary source file:** Germany PBF from Geofabrik  
  `https://download.geofabrik.de/europe/germany-latest.osm.pbf`
- **Refresh cadence:** nightly (every 24h).
- **Expected freshness marker:** output metadata includes input filename + extraction timestamp (UTC).

## Required Extraction Logic

### 1) Osmium prefilter (required)

Use `osmium tags-filter` to reduce input size before GDAL conversion.

Required tag expressions:

- `r/boundary=administrative`
- `w/boundary=administrative`

Reference command shape:

```bash
osmium tags-filter \
  -o germany-boundaries-administrative.osm.pbf \
  -O germany-latest.osm.pbf \
  r/boundary=administrative \
  w/boundary=administrative
```

### 2) Feature selection + key normalization (required)

During conversion to final output, include only features that satisfy:

- `boundary = administrative`, and
- either non-empty `de:regionalschluessel`, or national Germany polygon (`admin_level=2`, `name=Deutschland`).

Special rule:

- If Germany (`admin_level=2`, `name=Deutschland`) has missing `de:regionalschluessel`, set synthetic value `000000000000`.

## Output Target Format

## Canonical output

- **Format:** FlatGeobuf (`.fgb`)
- **Layer name:** `boundaries`
- **Geometry type:** polygon/multipolygon administrative boundaries
- **Recommended filename:** `germany-admin-boundaries-rs.fgb`
- **Recommended location:** shared runtime cache path (for example `.cache/osm/` in this repo or equivalent Tilda Geo data store)

### Required output attributes

- `geometry`
- `de:regionalschluessel` (string, non-empty except synthetic national fallback now filled)
- `boundary`
- `admin_level`
- `name`
- `osm_id` (if available from loader)

## Minimum SQL semantics (GDAL/OGR step)

Equivalent to:

```sql
SELECT geometry,
  CASE
    WHEN admin_level = '2' AND name = 'Deutschland'
      AND ("de:regionalschluessel" IS NULL OR "de:regionalschluessel" = '')
    THEN '000000000000'
    ELSE "de:regionalschluessel"
  END AS "de:regionalschluessel"
FROM multipolygons
WHERE boundary = 'administrative'
  AND (
    ("de:regionalschluessel" IS NOT NULL AND "de:regionalschluessel" <> '')
    OR (admin_level = '2' AND name = 'Deutschland')
  )
```

## Non-functional Requirements

- **Runtime stability:** job should fail fast on missing source file or conversion errors.
- **Idempotency:** rerun on same input should produce equivalent dataset.
- **Storage:** replace output atomically to avoid partial reads by downstream jobs.
- **Observability:** log start/end timestamps, input source, output path, feature count, and exit status.

## Scheduling Requirements (Tilda Geo)

- Run once nightly in Tilda Geo (suggestion: 02:00 Europe/Berlin).
- Optional optimization: skip run only if source file timestamp/hash is unchanged.
- Keep last successful output available until new run completes successfully.

## Acceptance Criteria

- Nightly job completes with exit code `0`.
- Output file exists and is readable as FlatGeobuf.
- Layer `boundaries` can be queried and returns administrative polygons.
- All records have a usable `de:regionalschluessel`; Germany national polygon uses `000000000000` when missing in source.
- Downstream compare step can consume the file without config changes.

## Open Decisions

- Whether Tilda Geo should also publish a secondary GeoJSON export for manual inspection.
- Retention policy for historical nightly outputs (for example keep last 7/30 snapshots).
