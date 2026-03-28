# Report UI (Bun + React)

Bundled with **Bun’s HTML pipeline** (`index.html` entry → TSX/JS/CSS). No Vite.

- **Dev**: `bun dev` runs [`dev-server.ts`](./dev-server.ts) — `Bun.serve` with an [HTML import](https://bun.sh/docs/bundler/fullstack), HMR, `/datasets/*` and `/__areas.json` from the repo root. **`predev` / `prebuild`** run [`generateAreasJson.ts`](./generateAreasJson.ts) so committed [`__areas.json`](../__areas.json) stays in sync (lists dataset slugs with `output/comparison_table.json`). The home page loads it at `/__areas.json`.
- **Build**: `bun run build` → `bun build ./index.html --outdir=dist --minify`
- **Preview**: `bun run preview` serves `dist/` plus `datasets/` and `__areas.json` the same way as dev.

Tailwind v4 is wired via [`bun-plugin-tailwind`](https://bun.sh/docs/bundler/html) in [`bunfig.toml`](./bunfig.toml).

Basemap: [OpenFreeMap](https://openfreemap.org/) Positron (`https://tiles.openfreemap.org/styles/positron`).
