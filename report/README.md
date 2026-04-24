# Report UI (Vite + React)

The app is built with **Vite** and consumes static runtime artifacts from `datasets/`, `data/`, and `areas.gen.json`.

- **Dev**: `bun run dev` (Vite dev server).
- **Dev (with Rust compare bootstrap)**: `bun run dev:with-rust`.
- **Preview**: `bun run preview` (Vite preview for `dist/`).
- **Sync runtime assets**: `bun run sync-runtime-assets` copies from `DATA_ROOT` (`datasets/`, `data/`) into `report/public` and regenerates repo-root `areas.gen.json`.
- **Build app shell**: `bun run build` builds Vite output and bundles static assets from `report/public` + `areas.gen.json`.
- **Build from runtime in one command**: `bun run build:with-runtime`.

Runtime root resolution:

- If `DATA_ROOT` is set, report scripts read runtime files from there.
- Otherwise scripts default to the repository root.

When report work includes running compare/pipeline steps, run Rust setup first in repo root:

```bash
bun run rust:build
```

Routing/query handling uses **TanStack Router** with **Zod**-validated payload parsing.  
Basemap: [OpenFreeMap](https://openfreemap.org/) Positron (`https://tiles.openfreemap.org/styles/positron`).
