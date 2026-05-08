# BKG VG25 scripts

- **`download.ts`** — Download or copy `vg25.utm32s.gpkg.zip` into `.cache/bkg/`, unzip, write `download-metadata.json`.
- **`extract.ts`** — `ogr2ogr` from cached GeoPackage to each area’s `source/official.fgb` (uses each dataset `config.jsonc` field `officialProfile`).

From the repo root, prefer the CLIs:

- `bun run download -- --yes --targets bkg` — fetch or refresh the BKG ZIP in `.cache/bkg/`
- `bun run extract:official` — menu or `bun run extract:official -- --yes` for all BKG + HTTP areas; `bun run extract:official -- --area <folder>` for one VG25-backed dataset

The `scripts` package still exposes `download:bkg` / `extract:bkg` for the pipeline (`bun run --filter ./scripts extract:bkg -- --yes`, etc.).
