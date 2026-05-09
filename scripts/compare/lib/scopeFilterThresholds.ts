/**
 * Per-candidate ribbon-edge fallback thresholds for the OSM scope filter
 * (see `scope-filter-coverage` in {@link ../../../rust/geom-sidecar/src/main.rs}).
 *
 * The Rust RTree path applies them per individual official polygon: when an OSM
 * polygon merely intersects a candidate official polygon at the boundary, we
 * keep it only if the geodesic intersection area is large enough in absolute
 * terms AND covers a non-trivial share of the OSM polygon. Without this,
 * border ribbons would leak across state boundaries into `unmatched_osm`.
 */

/** Minimum geodesic intersection area (m²) for the per-candidate ribbon-edge fallback. */
export const MERGED_SCOPE_FALLBACK_MIN_INTERSECTION_M2 = 100_000

/** Minimum share of the OSM polygon area covered by the intersection. */
export const MERGED_SCOPE_FALLBACK_MIN_OVERLAP_RATIO = 0.08
