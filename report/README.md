# Report UI (Bun + React)

Bundled with **Bun’s HTML pipeline** (`index.html` entry → TSX/JS/CSS). No Vite.

- **Dev**: `bun dev` runs [`dev-server.ts`](./dev-server.ts) — `Bun.serve` with an [HTML import](https://bun.sh/docs/bundler/fullstack), HMR, `/datasets/*` and `/data/*` static file serving, plus `/api/areas*` endpoints backed by the runtime SQLite DB.
- **Build**: `bun run build` → `bun build ./index.html --outdir=dist --minify`
- **Preview**: `bun run preview` serves `dist/` with the same `/api/areas*`, `/datasets/*`, and `/data/*` behavior as dev.

Tailwind v4 is wired via [`bun-plugin-tailwind`](https://bun.sh/docs/bundler/html) in [`bunfig.toml`](./bunfig.toml).

Basemap: [OpenFreeMap](https://openfreemap.org/) Positron (`https://tiles.openfreemap.org/styles/positron`).
