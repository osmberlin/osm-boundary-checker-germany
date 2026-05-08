---
name: boundary-test-runs
description: Run and troubleshoot OSM boundary checker test and refresh pipelines with Rust geom sidecar requirements. Use when the user asks for local pipeline/test run commands, Rust setup steps, performance checks, or BKG-skip workflows.
---

# Boundary Test Runs

## Run This First (Rust setup)

Compare runs require the Rust sidecar binary.

```bash
cargo build --release --manifest-path rust/geom-sidecar/Cargo.toml
```

If using a non-default binary location, set:

```bash
export RUST_GEOM_BIN="/absolute/path/to/geom-sidecar"
```

## Common Runbooks

### Quick test run (skip BKG download)

```bash
bun run extract:official -- --yes && bun run extract:osm -- --yes && bun run compare -- --yes --all
```

Force-refresh only official HTTP sources first:

```bash
bun run extract:official -- --yes --force && bun run extract:osm -- --yes && bun run compare -- --yes --all
```

### Full refresh run (includes BKG)

```bash
bun run scripts/pipeline/nightly.ts -- --phase all
```

## Single-area sanity check

```bash
bun run scripts/compare/compare-boundaries.ts -- --area hamburg-bezirke
```

## What to check after a run

- `data/internal-compare-timing.jsonl` has `compare_run_start`, `compare_phase`, `compare_run_end`.
- Slow phases are usually `load_osm`, `tippecanoe_main`, or `metrics` for larger datasets.
- `output/features/` should contain per-feature detail shards for each dataset.

## Fast troubleshooting

- **Binary missing error**: rebuild with `cargo build --release --manifest-path rust/geom-sidecar/Cargo.toml`.
- **CI mismatch**: ensure workflow builds `rust/geom-sidecar` and exports `RUST_GEOM_BIN`.
- **Unexpected slowdowns**: compare recent timings in `data/internal-compare-timing.jsonl` by phase and area.
