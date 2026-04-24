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

let warned = false

function warnOnce(message: string) {
  if (warned) return
  warned = true
  console.warn(message)
}

function defaultRustBinaryPath(): string {
  const here = dirname(fileURLToPath(import.meta.url))
  const ext = process.platform === 'win32' ? '.exe' : ''
  return join(here, '../../../rust/geom-sidecar/target/release/geom-sidecar' + ext)
}

function rustGeomEnabled(): boolean {
  return process.env.RUST_GEOM?.trim() === '1'
}

function runRustCommand<TInput, TOutput>(command: string, payload: TInput): TOutput | null {
  if (!rustGeomEnabled()) return null
  const bin = process.env.RUST_GEOM_BIN?.trim() || defaultRustBinaryPath()
  if (!existsSync(bin)) {
    warnOnce(`[rust-geom] Binary not found at ${bin}; using TypeScript fallback.`)
    return null
  }
  const result = spawnSync(bin, [command], {
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 1024,
  })
  if (result.error || result.status !== 0) {
    const stderr = (result.stderr ?? '').trim()
    warnOnce(
      `[rust-geom] ${command} failed (${result.status ?? 'spawn_error'}): ${
        stderr || String(result.error)
      }. Using TypeScript fallback.`,
    )
    return null
  }
  try {
    return JSON.parse(result.stdout) as TOutput
  } catch {
    warnOnce(`[rust-geom] ${command} produced invalid JSON; using TypeScript fallback.`)
    return null
  }
}

export function unionByKeyWithRust(buckets: RustUnionBucket[]): RustUnionResult[] | null {
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
  if (!output) return null
  return output.results.map((row) => ({
    key: row.key,
    geometry: row.geometry,
    feature_ids: row.feature_ids,
    properties: row.properties,
  }))
}

export function calculateMetricsBatchWithRust(
  rows: Array<{ officialProjected: Geometry | null; osmProjected: Geometry | null }>,
): Array<MetricResult | null> | null {
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
  if (!output) return null
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
): RustDiffBatchResult[] | null {
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
  if (!output) return null
  return output.rows.map((row) => ({
    canonicalMatchKey: row.canonical_match_key,
    externalDiff: row.external_diff,
    osmDiff: row.osm_diff,
  }))
}
