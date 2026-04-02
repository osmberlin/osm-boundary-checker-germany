# BKG VG25 scripts

- **`download.ts`** — Download or copy `vg25.utm32s.gpkg.zip` into `.cache/bkg/`, unzip, write `download-metadata.json`.
- **`extract.ts`** — `ogr2ogr` from cached GeoPackage to each area’s `source/official.fgb` (see workspace `bkg.config.json`).

Run from repo root through Docker:

- `docker compose run --rm pipeline bun run bkg:download`
- `docker compose run --rm pipeline bun run bkg:extract`
- `docker compose run --rm pipeline bun run bkg`
- Full pipeline: `docker compose run --rm pipeline bun run download`
