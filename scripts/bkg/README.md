# BKG VG25 scripts

- **`download.ts`** — Download or copy `vg25.utm32s.gpkg.zip` into `.cache/bkg/`, unzip, write `download-metadata.json`.
- **`extract.ts`** — `ogr2ogr` from cached GeoPackage to each area’s `source/official.fgb` (see workspace `bkg.config.json`).

Run from repo root: `bun run bkg:download`, `bun run bkg:extract`, or `bun run bkg` for both (aliases: `download:bkg:*`, full pipeline: `bun run download`).
