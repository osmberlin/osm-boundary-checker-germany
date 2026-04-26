# Runtime storage strategy

## Recommendation

Use a local SQL database on shared local storage for runtime metadata, and keep PMTiles as files.

- Keep PMTiles file-based (`comparison.pmtiles`, `unmatched.pmtiles`) for MapLibre range-request performance.
- Move heavy table/detail payload (`comparison_table.json` fields) into DB-backed reads.
- Keep chart stats in DB (`area_runs`) with no `snapshots.json` runtime mirror.

## Turso direction

Preferred direction for this project is Turso Database (SQLite-compatible) running locally on the same host.

- Project reference: [tursodatabase/turso](https://github.com/tursodatabase/turso)
- Important caveat: upstream currently marks Turso Database as beta and recommends production caution with backups.

Because of that, rollout should include:

1. Daily local backups of the DB file on the shared volume.
2. Engine-agnostic SQL schema and endpoint contracts so fallback to another SQLite engine remains possible.
3. Keep PMTiles and optional edit GeoJSON file-backed when they are a better fit than DB blobs.

## Minimal runtime model

- `areas` (area metadata)
- `area_runs` (chart stats over time)
- `area_rows` (table rows without heavy props)
- `area_row_props` (heavy per-feature details, loaded on demand)
- `unmatched_rows`
- `source_metadata`

Draft DDL: [`sqlite-runtime-schema.sql`](./sqlite-runtime-schema.sql).

## API shape (Bun)

- `GET /api/areas`
- `GET /api/areas/:area`
- `GET /api/areas/:area/features/:key`
- `GET /api/areas/:area/unmatched`
- `GET /api/areas/:area/runs`

This keeps the home page and area table payloads small while preserving full feature detail when requested.
