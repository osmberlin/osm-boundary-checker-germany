# Report UI (Bun + React)

Bundled with **Bun’s HTML pipeline** (`index.html` entry → TSX/JS/CSS). No Vite.

- **Dev**: `bun dev` runs `[dev-server.ts](./dev-server.ts)` — `Bun.serve` with an [HTML import](https://bun.sh/docs/bundler/fullstack), HMR, `/areas.gen.json`, `/datasets/`_, and `/data/`_ static file serving.
- **Build**: `bun run build` → prepare static snapshot + `bun build ./index.html --outdir=dist --minify` + asset bundling into `dist/`.
- **Preview**: `bun run preview` serves `dist/` with the same static behavior as dev.

Tailwind v4 is wired via `[bun-plugin-tailwind](https://bun.sh/docs/bundler/html)` in `[bunfig.toml](./bunfig.toml)`.
Routing/query handling uses **TanStack Router** with **Zod**-validated payload parsing.

Basemap: [OpenFreeMap](https://openfreemap.org/) Positron (`https://tiles.openfreemap.org/styles/positron`).
