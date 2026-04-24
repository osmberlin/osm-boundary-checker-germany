# OSM Reuse Investigation (Cross-Area Compare)

## Problem

Each area compare currently runs in its own process via `run.ts`, and each run reloads and deserializes the shared OSM FlatGeobuf from disk. For national runs, this repeats expensive IO and decode work.

## Options Evaluated

1. **Keep current per-area process model**
   - Expected gain: none
   - Complexity: none
   - Risk: none

2. **Single process, multi-area compare with in-memory OSM reuse (recommended)**
   - What changes:
     - Add a batched compare execution path that keeps one process alive for all areas.
     - Load shared OSM once per `osmPath` and reuse parsed features across areas.
   - Expected gain: medium to high (especially on `de-*` datasets)
   - Complexity: medium
   - Risk: medium (memory pressure on constrained runners)

3. **Rust sidecar adds persistent daemon/index**
   - What changes:
     - Move cross-area orchestration and caching into a long-lived Rust service.
   - Expected gain: high potential
   - Complexity: high
   - Risk: high (new protocol/process lifecycle and operational complexity)

4. **Pre-split OSM extracts by region**
   - What changes:
     - Build and maintain additional per-region/per-area OSM artifacts.
   - Expected gain: medium
   - Complexity: medium to high
   - Risk: medium (artifact management, staleness concerns)

## Recommendation

Implement **Option 2** first:

- Introduce a new compare orchestration path that:
  - groups areas by resolved `osmPath`,
  - loads each shared OSM dataset once,
  - runs area matching/output generation against reused in-memory OSM features.
- Keep current per-area process mode as a fallback path only for emergency rollback.

## Suggested Rollout

1. Add internal phase timing (already planned) to baseline current load/decode cost.
2. Implement batched multi-area execution path behind a dedicated command.
3. Compare before/after timings for:
   - total runtime,
   - per-area `load_osm` phase,
   - peak memory.
4. Promote batched path to default when stability is proven.
