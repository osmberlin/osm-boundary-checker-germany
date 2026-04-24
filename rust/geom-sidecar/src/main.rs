use std::io::{self, Read};

use anyhow::{Context, Result, anyhow, bail};
use geo::{Area, BooleanOps, GeodesicArea, HausdorffDistance, MultiPolygon};
use geojson::Geometry;
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

fn main() -> Result<()> {
    let command = std::env::args()
        .nth(1)
        .ok_or_else(|| anyhow!("missing command: union-by-key | metrics-batch | diff-batch"))?;

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
