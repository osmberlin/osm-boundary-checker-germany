# Cache Policy For Refresh And Deploy

This policy explains why cache artifacts exist, what each scope is for, and which files are intentionally excluded.

## Why cache exists

- **Report/Pages deploy:** consumes prebuilt dataset outputs and static payloads from artifact, without running compare.
- **Refresh fallback:** nightly/manual refresh should attempt fresh download and extract first. If a step fails, restore only the minimum fallback inputs needed to continue.
- **Refresh-window guard:** when source refresh is not required yet, cached source-derived artifacts are reused.

## Atomic fallback scopes

Artifacts are split by usage so recovery can restore only the failed part:

- `source-cache-osm`: shared extracted OSM FlatGeobuf inputs.
- `source-cache-official`: per-area official compare inputs (`official.fgb` + `metadata.json`).
- `compare-outputs` (optional tier): last-good per-area compare outputs and `snapshots.json`.
- `report-runtime-last-good`: deploy-only user-facing report payload (`datasets/*/output/**`, `snapshots.json`, and selected `data/*` files).

## Compare-ready keep/drop contract

### Keep

- `datasets/*/source/official.fgb`
- `datasets/*/source/metadata.json`
- `.cache/osm/germany-admin-boundaries-rs.fgb`
- `.cache/osm/germany-postal-code-boundaries.fgb`
- `datasets/*/output/**` and `datasets/*/snapshots.json` only in `report-runtime-last-good` (and optionally `compare-outputs` if that tier is enabled)

### Drop

- `.cache/osm/*.pbf`
- `.cache/bkg/*.zip`
- `.cache/bkg/**/*.gpkg`
- any raw/intermediate source archives that are not direct compare inputs

## Visibility

Each refresh run writes:

- `artifact-index.json` with per-scope inventory and byte stats.
- `cache-scopes-summary.md` for human-readable Action Summary output.

Current no-dup setup keeps compare outputs in the deploy artifact only and omits `compare-outputs` publication by default.

This keeps the policy reviewable and makes drift visible during run review.
