use std::io::{self, Read};

use anyhow::{Context, Result, anyhow, bail};
use geo::{Area, BooleanOps, Centroid, Contains, GeodesicArea, HausdorffDistance, Intersects, MultiPolygon};
use geojson::Geometry;
use rstar::{RTree, RTreeObject, AABB};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct UnionByKeyInput {
    buckets: Vec<UnionBucket>,
}

#[derive(Debug, Deserialize)]
struct UnionBucket {
    key: String,
    geometries: Vec<Geometry>,
    feature_ids: Vec<String>,
    properties: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Serialize)]
struct UnionByKeyOutput {
    results: Vec<UnionResult>,
}

#[derive(Debug, Serialize)]
struct UnionResult {
    key: String,
    geometry: Option<Geometry>,
    feature_ids: Vec<String>,
    properties: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Debug, Deserialize)]
struct MetricsBatchInput {
    rows: Vec<MetricsRowInput>,
}

#[derive(Debug, Deserialize)]
struct MetricsRowInput {
    official_projected: Option<Geometry>,
    osm_projected: Option<Geometry>,
}

#[derive(Debug, Serialize)]
struct MetricsBatchOutput {
    rows: Vec<Option<MetricResult>>,
}

#[derive(Debug, Serialize)]
struct MetricResult {
    iou: f64,
    area_diff_pct: f64,
    symmetric_diff_pct: f64,
    hausdorff_m: f64,
    official_area_m2: f64,
    osm_area_m2: f64,
}

#[derive(Debug, Deserialize)]
struct DiffBatchInput {
    rows: Vec<DiffRowInput>,
}

#[derive(Debug, Deserialize)]
struct DiffRowInput {
    category: String,
    canonical_match_key: String,
    official_geometry_wgs84: Option<Geometry>,
    osm_geometry_wgs84: Option<Geometry>,
}

#[derive(Debug, Serialize)]
struct DiffBatchOutput {
    rows: Vec<DiffRowOutput>,
}

#[derive(Debug, Serialize)]
struct DiffRowOutput {
    canonical_match_key: String,
    external_diff: Option<Geometry>,
    osm_diff: Option<Geometry>,
}

#[derive(Debug, Deserialize)]
struct ScopeFilterRowInput {
    row_index: usize,
    geometry: Option<Geometry>,
    bbox: Option<[f64; 4]>,
}

#[derive(Debug, Deserialize)]
struct ScopeFilterCoverageInput {
    /// Individual official polygons (no merge). The Rust side builds an RTree of their
    /// envelopes and runs per-OSM bbox-prune + per-candidate intersect/area tests.
    official: Vec<ScopeFilterOfficialInput>,
    /// OSM features to scope-filter; row_index is preserved in the output.
    rows: Vec<ScopeFilterRowInput>,
    /// Per-candidate ribbon-edge fallback thresholds (applied per individual candidate, not against a mega-poly).
    min_intersection_area_m2: f64,
    min_overlap_ratio: f64,
}

#[derive(Debug, Deserialize)]
struct ScopeFilterOfficialInput {
    bbox: [f64; 4],
    geometry: Geometry,
}

#[derive(Debug, Serialize)]
struct ScopeFilterCoverageOutput {
    keep_row_indexes: Vec<usize>,
}

/// Wrapper so rstar can index official polygons by their bbox while we keep the
/// original Vec index for cheap geometry lookup at query time.
struct OfficialEnvelope {
    aabb: AABB<[f64; 2]>,
    index: usize,
}

impl RTreeObject for OfficialEnvelope {
    type Envelope = AABB<[f64; 2]>;
    fn envelope(&self) -> Self::Envelope {
        self.aabb
    }
}

fn main() -> Result<()> {
    let command = std::env::args().nth(1).ok_or_else(|| {
        anyhow!(
            "missing command: union-by-key | metrics-batch | diff-batch | scope-filter-coverage"
        )
    })?;

    let input = read_stdin()?;
    match command.as_str() {
        "union-by-key" => {
            let payload: UnionByKeyInput =
                serde_json::from_str(&input).context("parse union-by-key input")?;
            let output = union_by_key(payload);
            write_stdout(&output)?;
        }
        "metrics-batch" => {
            let payload: MetricsBatchInput =
                serde_json::from_str(&input).context("parse metrics-batch input")?;
            let output = metrics_batch(payload);
            write_stdout(&output)?;
        }
        "diff-batch" => {
            let payload: DiffBatchInput =
                serde_json::from_str(&input).context("parse diff-batch input")?;
            let output = diff_batch(payload);
            write_stdout(&output)?;
        }
        "scope-filter-coverage" => {
            let payload: ScopeFilterCoverageInput =
                serde_json::from_str(&input).context("parse scope-filter-coverage input")?;
            let output = scope_filter_coverage(payload);
            write_stdout(&output)?;
        }
        _ => bail!("unknown command: {command}"),
    }
    Ok(())
}

fn read_stdin() -> Result<String> {
    let mut s = String::new();
    io::stdin().read_to_string(&mut s)?;
    Ok(s)
}

fn write_stdout<T: Serialize>(value: &T) -> Result<()> {
    let out = serde_json::to_string(value)?;
    print!("{out}");
    Ok(())
}

fn geometry_to_multi_polygon(g: &Geometry) -> Option<MultiPolygon<f64>> {
    let geom: geo::Geometry<f64> = g.value.clone().try_into().ok()?;
    match geom {
        geo::Geometry::Polygon(p) => Some(MultiPolygon(vec![p])),
        geo::Geometry::MultiPolygon(mp) => Some(mp),
        _ => None,
    }
}

fn multi_polygon_to_geometry(mp: MultiPolygon<f64>) -> Option<Geometry> {
    if mp.0.is_empty() {
        return None;
    }
    let g = geo::Geometry::MultiPolygon(mp);
    let value = (&g).into();
    Some(Geometry::new(value))
}

fn union_by_key(input: UnionByKeyInput) -> UnionByKeyOutput {
    let mut results = Vec::with_capacity(input.buckets.len());
    for bucket in input.buckets {
        let mut merged: Option<MultiPolygon<f64>> = None;
        for geom in &bucket.geometries {
            let Some(next) = geometry_to_multi_polygon(geom) else {
                continue;
            };
            merged = Some(match merged {
                Some(current) => current.union(&next),
                None => next,
            });
        }
        results.push(UnionResult {
            key: bucket.key,
            geometry: merged.and_then(multi_polygon_to_geometry),
            feature_ids: bucket.feature_ids,
            properties: bucket.properties,
        });
    }
    UnionByKeyOutput { results }
}

fn compute_iou(intersection: f64, union: f64) -> f64 {
    if union <= 0.0 { 0.0 } else { intersection / union }
}

fn compute_area_delta_pct(a1: f64, a2: f64) -> f64 {
    if a1 <= 0.0 {
        return if a2 <= 0.0 { 0.0 } else { 100.0 };
    }
    ((a2 - a1).abs() / a1) * 100.0
}

fn compute_symmetric_diff_pct(a1: f64, a2: f64, inter: f64) -> f64 {
    if a1 <= 0.0 || a2 <= 0.0 {
        return 100.0;
    }
    let sym = (a1 + a2 - 2.0 * inter).max(0.0);
    (sym / a1.max(a2)) * 100.0
}

fn metrics_for_pair(official: &Geometry, osm: &Geometry) -> Option<MetricResult> {
    let official_mp = geometry_to_multi_polygon(official)?;
    let osm_mp = geometry_to_multi_polygon(osm)?;

    let a1 = official_mp.unsigned_area();
    let a2 = osm_mp.unsigned_area();
    if a1 <= 0.0 || a2 <= 0.0 {
        return None;
    }

    let inter = official_mp.intersection(&osm_mp);
    let inter_area = inter.unsigned_area();

    let uni = official_mp.union(&osm_mp);
    let union_area = uni.unsigned_area();

    let hausdorff_m = official_mp.hausdorff_distance(&osm_mp);

    Some(MetricResult {
        iou: compute_iou(inter_area, union_area),
        area_diff_pct: compute_area_delta_pct(a1, a2),
        symmetric_diff_pct: compute_symmetric_diff_pct(a1, a2, inter_area),
        hausdorff_m,
        official_area_m2: a1,
        osm_area_m2: a2,
    })
}

fn metrics_batch(input: MetricsBatchInput) -> MetricsBatchOutput {
    let mut out = Vec::with_capacity(input.rows.len());
    for row in input.rows {
        let metric = match (row.official_projected.as_ref(), row.osm_projected.as_ref()) {
            (Some(official), Some(osm)) => metrics_for_pair(official, osm),
            _ => None,
        };
        out.push(metric);
    }
    MetricsBatchOutput { rows: out }
}

fn diff_batch(input: DiffBatchInput) -> DiffBatchOutput {
    let mut rows = Vec::with_capacity(input.rows.len());
    for row in input.rows {
        let mut external_diff = None;
        let mut osm_diff = None;

        if row.category == "matched" {
            if let (Some(official), Some(osm)) = (
                row.official_geometry_wgs84.as_ref(),
                row.osm_geometry_wgs84.as_ref(),
            ) {
                if let (Some(off_mp), Some(osm_mp)) = (
                    geometry_to_multi_polygon(official),
                    geometry_to_multi_polygon(osm),
                ) {
                    external_diff = multi_polygon_to_geometry(off_mp.difference(&osm_mp))
                        .filter(has_min_geodesic_area);
                    osm_diff = multi_polygon_to_geometry(osm_mp.difference(&off_mp))
                        .filter(has_min_geodesic_area);
                }
            }
        } else if row.category == "official_only" {
            external_diff = row
                .official_geometry_wgs84
                .and_then(|g| geometry_to_multi_polygon(&g).and_then(multi_polygon_to_geometry))
                .filter(has_min_geodesic_area);
        }

        rows.push(DiffRowOutput {
            canonical_match_key: row.canonical_match_key,
            external_diff,
            osm_diff,
        });
    }
    DiffBatchOutput { rows }
}

fn has_min_geodesic_area(geometry: &Geometry) -> bool {
    let Some(mp) = geometry_to_multi_polygon(geometry) else {
        return false;
    };
    mp.geodesic_area_signed().abs() >= 1e-6
}

fn is_substantive_overlap(
    osm_mp: &MultiPolygon<f64>,
    merged_mp: &MultiPolygon<f64>,
    min_intersection_area_m2: f64,
    min_overlap_ratio: f64,
) -> bool {
    let inter = osm_mp.intersection(merged_mp);
    let inter_area = inter.geodesic_area_signed().abs();
    if inter_area < min_intersection_area_m2 {
        return false;
    }
    let osm_area = osm_mp.geodesic_area_signed().abs();
    if osm_area <= 0.0 {
        return false;
    }
    inter_area / osm_area >= min_overlap_ratio
}

fn aabb_from_bbox(bbox: [f64; 4]) -> AABB<[f64; 2]> {
    // bbox is [minX, minY, maxX, maxY] in WGS84 lon/lat.
    AABB::from_corners([bbox[0], bbox[1]], [bbox[2], bbox[3]])
}

/// RTree-backed scope filter: per OSM polygon we bbox-prune to a small candidate set of
/// individual official polygons, then test intersect (with the per-candidate ribbon-edge
/// fallback) against just those candidates. Replaces the merged-mega-polygon path that
/// scaled as O(n_osm * verts(merged)).
fn scope_filter_coverage(input: ScopeFilterCoverageInput) -> ScopeFilterCoverageOutput {
    if input.official.is_empty() {
        return ScopeFilterCoverageOutput {
            keep_row_indexes: Vec::new(),
        };
    }

    // Decode official polygons once. Drop any that fail to parse: they would be unreachable
    // via the RTree anyway, so we treat them as if they weren't in the official set.
    let mut official_polys: Vec<Option<MultiPolygon<f64>>> = Vec::with_capacity(input.official.len());
    let mut envelopes: Vec<OfficialEnvelope> = Vec::with_capacity(input.official.len());
    for (index, off) in input.official.iter().enumerate() {
        official_polys.push(geometry_to_multi_polygon(&off.geometry));
        if official_polys[index].is_some() {
            envelopes.push(OfficialEnvelope {
                aabb: aabb_from_bbox(off.bbox),
                index,
            });
        }
    }
    if envelopes.is_empty() {
        return ScopeFilterCoverageOutput {
            keep_row_indexes: Vec::new(),
        };
    }
    // bulk_load is O(n) and significantly faster than repeated insert for large inputs.
    let tree: RTree<OfficialEnvelope> = RTree::bulk_load(envelopes);

    let mut keep = Vec::new();
    for row in input.rows {
        let Some(osm_bbox) = row.bbox else {
            continue;
        };
        let Some(geometry) = row.geometry.as_ref() else {
            continue;
        };
        let Some(osm_mp) = geometry_to_multi_polygon(geometry) else {
            continue;
        };

        let query_aabb = aabb_from_bbox(osm_bbox);
        let candidates = tree.locate_in_envelope_intersecting(&query_aabb);

        // Fast path: if any candidate intersects, keep immediately. The substantive-overlap
        // fallback only matters when intersect succeeds against a candidate that the OSM
        // polygon merely grazes; we apply it per-candidate to preserve parity with the
        // pre-RTree thresholds without ever building a mega-poly.
        let mut kept = false;
        for candidate in candidates {
            let Some(off_mp) = official_polys[candidate.index].as_ref() else {
                continue;
            };
            if !osm_mp.intersects(off_mp) {
                continue;
            }
            // Cheap confirmation first: centroid inside this candidate ⇒ keep.
            let centroid_inside = osm_mp
                .centroid()
                .map(|p| off_mp.contains(&p))
                .unwrap_or(false);
            if centroid_inside {
                kept = true;
                break;
            }
            // Otherwise check the per-candidate ribbon-edge thresholds.
            if is_substantive_overlap(
                &osm_mp,
                off_mp,
                input.min_intersection_area_m2,
                input.min_overlap_ratio,
            ) {
                kept = true;
                break;
            }
        }
        if kept {
            keep.push(row.row_index);
        }
    }

    ScopeFilterCoverageOutput {
        keep_row_indexes: keep,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a closed-ring axis-aligned `Polygon` Geometry in WGS84 lon/lat.
    fn rect(lon1: f64, lat1: f64, lon2: f64, lat2: f64) -> Geometry {
        Geometry::new(geojson::Value::Polygon(vec![vec![
            vec![lon1, lat1],
            vec![lon2, lat1],
            vec![lon2, lat2],
            vec![lon1, lat2],
            vec![lon1, lat1],
        ]]))
    }

    fn official(lon1: f64, lat1: f64, lon2: f64, lat2: f64) -> ScopeFilterOfficialInput {
        ScopeFilterOfficialInput {
            bbox: [lon1, lat1, lon2, lat2],
            geometry: rect(lon1, lat1, lon2, lat2),
        }
    }

    fn row(
        row_index: usize,
        lon1: f64,
        lat1: f64,
        lon2: f64,
        lat2: f64,
    ) -> ScopeFilterRowInput {
        ScopeFilterRowInput {
            row_index,
            geometry: Some(rect(lon1, lat1, lon2, lat2)),
            bbox: Some([lon1, lat1, lon2, lat2]),
        }
    }

    fn run(officials: Vec<ScopeFilterOfficialInput>, rows: Vec<ScopeFilterRowInput>) -> Vec<usize> {
        let out = scope_filter_coverage(ScopeFilterCoverageInput {
            official: officials,
            rows,
            min_intersection_area_m2: 100_000.0,
            min_overlap_ratio: 0.08,
        });
        out.keep_row_indexes
    }

    #[test]
    fn keeps_osm_polygon_with_centroid_inside_official_candidate() {
        // Single official square; OSM square fully inside ⇒ centroid_inside ⇒ keep.
        let out = run(
            vec![official(9.0, 50.0, 9.2, 50.2)],
            vec![row(0, 9.05, 50.05, 9.1, 50.1)],
        );
        assert_eq!(out, vec![0]);
    }

    #[test]
    fn drops_osm_polygon_far_from_all_officials_via_rtree_prune() {
        // OSM bbox doesn't intersect any official bbox ⇒ RTree returns 0 candidates ⇒ drop.
        let out = run(
            vec![official(9.0, 50.0, 9.05, 50.05)],
            vec![row(0, 10.0, 51.0, 10.05, 51.05)],
        );
        assert!(out.is_empty(), "expected empty, got {out:?}");
    }

    #[test]
    fn rejects_cross_state_ribbon_edge_overlap() {
        // Tall thin OSM polygon ribboning along the eastern edge of the official polygon:
        // intersects but the per-candidate substantive-overlap threshold should reject it.
        let out = run(
            vec![official(9.0, 50.0, 9.2, 50.2)],
            vec![row(0, 9.15, 50.0, 11.0, 50.2)],
        );
        assert!(out.is_empty(), "expected empty, got {out:?}");
    }

    #[test]
    fn keeps_when_only_one_of_many_candidates_passes() {
        // Two adjacent official polygons. OSM square sits inside the right one only;
        // the RTree may return both as bbox candidates but the inner intersect+centroid
        // pass on the right one keeps the row exactly once.
        let out = run(
            vec![
                official(9.0, 50.0, 9.1, 50.1),
                official(9.1, 50.0, 9.2, 50.1),
            ],
            vec![row(0, 9.12, 50.02, 9.18, 50.08)],
        );
        assert_eq!(out, vec![0]);
    }

    #[test]
    fn returns_empty_when_official_set_is_empty() {
        let out = run(vec![], vec![row(0, 9.0, 50.0, 9.1, 50.1)]);
        assert!(out.is_empty());
    }
}
