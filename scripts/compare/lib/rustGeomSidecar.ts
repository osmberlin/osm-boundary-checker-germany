import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Geometry } from 'geojson'
import type { MetricResult } from './metrics/types.ts'

type RustUnionBucket = {
  key: string
  geometries: Geometry[]
  feature_ids: string[]
  properties: Record<string, unknown> | null
}

type RustUnionResult = {
  key: string
  geometry: Geometry | null
  feature_ids: string[]
  properties: Record<string, unknown> | null
}

type RustDiffBatchResult = {
  canonicalMatchKey: string
  externalDiff: Geometry | null
  osmDiff: Geometry | null
}

function defaultRustBinaryPath(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const ext = process.platform === 'win32' ? '.exe' : ''
  return join(here, '../../../rust/geom-sidecar/target/release/geom-sidecar' + ext)
}

function rustBootstrapHint(bin: string): string {
  return (
    `Rust geometry sidecar is required for compare runs.\n` +
    `Expected binary: ${bin}\n\n` +
    `Build it with:\n` +
    `  cargo build --release --manifest-path rust/geom-sidecar/Cargo.toml\n\n` +
    `Optionally set RUST_GEOM_BIN to a custom binary path.`
  )
}

function runRustCommand<TInput, TOutput>(command: string, payload: TInput): TOutput {
  const bin = process.env.RUST_GEOM_BIN?.trim() || defaultRustBinaryPath()
  if (!existsSync(bin)) {
    throw new Error(rustBootstrapHint(bin))
  }
  const result = spawnSync(bin, [command], {
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    const stderr = (result.stderr ?? '').trim()
    throw new Error(
      `[rust-geom] ${command} failed (${result.status ?? 'spawn_error'}): ${
        stderr || String(result.error)
      }\n\n${rustBootstrapHint(bin)}`,
    )
  }
  try {
    return JSON.parse(result.stdout) as TOutput
  } catch (error) {
    throw new Error(
      `[rust-geom] ${command} produced invalid JSON: ${String(error)}\n\n${rustBootstrapHint(bin)}`,
    )
  }
}

export function unionByKeyWithRust(buckets: RustUnionBucket[]): RustUnionResult[] {
  const output = runRustCommand<
    { buckets: RustUnionBucket[] },
    {
      results: Array<{
        key: string
        geometry: Geometry | null
        feature_ids: string[]
        properties: Record<string, unknown> | null
      }>
    }
  >('union-by-key', { buckets })
  return output.results.map((row) => ({
    key: row.key,
    geometry: row.geometry,
    feature_ids: row.feature_ids,
    properties: row.properties,
  }))
}

export function calculateMetricsBatchWithRust(
  rows: Array<{ officialProjected: Geometry | null; osmProjected: Geometry | null }>,
): Array<MetricResult | null> {
  const output = runRustCommand<
    { rows: Array<{ official_projected: Geometry | null; osm_projected: Geometry | null }> },
    {
      rows: Array<{
        iou: number
        area_diff_pct: number
        symmetric_diff_pct: number
        hausdorff_m: number
        official_area_m2: number
        osm_area_m2: number
      } | null>
    }
  >('metrics-batch', {
    rows: rows.map((row) => ({
      official_projected: row.officialProjected,
      osm_projected: row.osmProjected,
    })),
  })
  return output.rows.map((row) =>
    row
      ? {
          iou: row.iou,
          areaDiffPct: row.area_diff_pct,
          symmetricDiffPct: row.symmetric_diff_pct,
          hausdorffM: row.hausdorff_m,
          officialAreaM2: row.official_area_m2,
          osmAreaM2: row.osm_area_m2,
        }
      : null,
  )
}

export function calculateDiffBatchWithRust(
  rows: Array<{
    category: 'matched' | 'official_only'
    canonicalMatchKey: string
    officialGeometryWgs84: Geometry | null
    osmGeometryWgs84: Geometry | null
  }>,
): RustDiffBatchResult[] {
  const output = runRustCommand<
    {
      rows: Array<{
        category: string
        canonical_match_key: string
        official_geometry_wgs84: Geometry | null
        osm_geometry_wgs84: Geometry | null
      }>
    },
    {
      rows: Array<{
        canonical_match_key: string
        external_diff: Geometry | null
        osm_diff: Geometry | null
      }>
    }
  >('diff-batch', {
    rows: rows.map((row) => ({
      category: row.category,
      canonical_match_key: row.canonicalMatchKey,
      official_geometry_wgs84: row.officialGeometryWgs84,
      osm_geometry_wgs84: row.osmGeometryWgs84,
    })),
  })
  return output.rows.map((row) => ({
    canonicalMatchKey: row.canonical_match_key,
    externalDiff: row.external_diff,
    osmDiff: row.osm_diff,
  }))
}
