import type { Database } from 'bun:sqlite'
import { openRuntimeDatabase } from '../scripts/shared/runtimeDb.ts'
import type {
  ComparisonForReport,
  OgcWfsInspectSource,
  ReportRow,
  SnapshotsJson,
  SourceMetadataSide,
  UnmatchedOsmReportRow,
} from './src/types/report'

export type AreaHomeSummary = {
  area: string
  matched: number
  officialOnly: number
  unmatchedOsm: number
}

type RunRow = {
  area_id: string
  run_id: string
  generated_at: string
  metrics_crs: string
  has_pmtiles: number
  has_unmatched_pmtiles: number
  tippecanoe_layer: string
  mean_iou: number
  matched_count: number
  official_only_count: number
  unmatched_count: number
}

type JoinedRow = {
  canonical_match_key: string
  name_label: string
  category: 'matched' | 'official_only'
  osm_relation_id: string
  map_bbox_json: string | null
  iou: number | null
  area_diff_pct: number | null
  symmetric_diff_pct: number | null
  hausdorff_m: number | null
  official_area_m2: number | null
  osm_area_m2: number | null
  official_props_json: string | null
  osm_props_json: string | null
  official_for_edit_path: string | null
}

type UnmatchedDbRow = {
  canonical_match_key: string
  name_label: string
  osm_relation_id: string
  admin_level: string | null
  map_bbox_json: string | null
}

type SourceMetadataRow = {
  official_json: string | null
  osm_json: string | null
  ogc_sources_json: string | null
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function withReadonlyDb<T>(runtimeRoot: string, fn: (db: Database) => T): T {
  const db = openRuntimeDatabase(runtimeRoot, true)
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

function latestRunForArea(db: Database, areaId: string): RunRow | null {
  const row = db
    .prepare(
      `
        SELECT
          area_id, run_id, generated_at, metrics_crs,
          has_pmtiles, has_unmatched_pmtiles, tippecanoe_layer,
          mean_iou, matched_count, official_only_count, unmatched_count
        FROM area_runs
        WHERE area_id = ?
        ORDER BY generated_at DESC, run_id DESC
        LIMIT 1
      `,
    )
    .get(areaId) as RunRow | null
  return row ?? null
}

function sourceMetadataForRun(
  db: Database,
  areaId: string,
  runId: string,
): {
  sourceMetadata:
    | { official: SourceMetadataSide | null; osm: SourceMetadataSide | null }
    | undefined
  ogcInspectSources: OgcWfsInspectSource[] | undefined
} {
  const row = db
    .prepare(
      `SELECT official_json, osm_json, ogc_sources_json FROM source_metadata WHERE area_id = ? AND run_id = ?`,
    )
    .get(areaId, runId) as SourceMetadataRow | null
  if (!row) return { sourceMetadata: undefined, ogcInspectSources: undefined }
  const official = parseJson<SourceMetadataSide | null>(row.official_json, null)
  const osm = parseJson<SourceMetadataSide | null>(row.osm_json, null)
  const ogc = parseJson<OgcWfsInspectSource[]>(row.ogc_sources_json, [])
  return {
    sourceMetadata: { official, osm },
    ogcInspectSources: ogc.length > 0 ? ogc : undefined,
  }
}

function reportRowFromDb(row: JoinedRow): ReportRow {
  const metricsPresent =
    row.iou != null &&
    row.area_diff_pct != null &&
    row.symmetric_diff_pct != null &&
    row.official_area_m2 != null &&
    row.osm_area_m2 != null
  return {
    canonicalMatchKey: row.canonical_match_key,
    nameLabel: row.name_label,
    category: row.category,
    osmRelationId: row.osm_relation_id,
    metrics: metricsPresent
      ? {
          iou: row.iou ?? 0,
          areaDiffPct: row.area_diff_pct ?? 0,
          symmetricDiffPct: row.symmetric_diff_pct ?? 0,
          hausdorffM: row.hausdorff_m ?? 0,
          officialAreaM2: row.official_area_m2 ?? 0,
          osmAreaM2: row.osm_area_m2 ?? 0,
        }
      : null,
    mapBbox: parseJson<[number, number, number, number] | null>(row.map_bbox_json, null),
    officialProperties: parseJson<Record<string, unknown> | null>(row.official_props_json, null),
    osmProperties: parseJson<Record<string, unknown> | null>(row.osm_props_json, null),
    officialForEditPath: row.official_for_edit_path,
  }
}

function unmatchedRowFromDb(row: UnmatchedDbRow): UnmatchedOsmReportRow {
  return {
    canonicalMatchKey: row.canonical_match_key,
    nameLabel: row.name_label,
    osmRelationId: row.osm_relation_id,
    adminLevel: row.admin_level,
    mapBbox: parseJson<[number, number, number, number] | null>(row.map_bbox_json, null),
  }
}

export function listAreaSummaries(runtimeRoot: string): AreaHomeSummary[] {
  return withReadonlyDb(runtimeRoot, (db) => {
    const rows = db
      .prepare(
        `
          SELECT area_id AS area, matched_count AS matched, official_only_count AS officialOnly, unmatched_count AS unmatchedOsm
          FROM (
            SELECT *,
              ROW_NUMBER() OVER (PARTITION BY area_id ORDER BY generated_at DESC, run_id DESC) AS rn
            FROM area_runs
          )
          WHERE rn = 1
          ORDER BY area ASC
        `,
      )
      .all() as AreaHomeSummary[]
    return rows
  })
}

export function loadComparisonForArea(
  runtimeRoot: string,
  areaId: string,
): ComparisonForReport | null {
  return withReadonlyDb(runtimeRoot, (db) => {
    const run = latestRunForArea(db, areaId)
    if (!run) return null
    const rows = db
      .prepare(
        `
          SELECT
            r.canonical_match_key, r.name_label, r.category, r.osm_relation_id, r.map_bbox_json,
            r.iou, r.area_diff_pct, r.symmetric_diff_pct, r.hausdorff_m, r.official_area_m2, r.osm_area_m2,
            p.official_props_json, p.osm_props_json, p.official_for_edit_path
          FROM area_rows r
          LEFT JOIN area_row_props p
            ON p.area_id = r.area_id AND p.run_id = r.run_id AND p.canonical_match_key = r.canonical_match_key
          WHERE r.area_id = ? AND r.run_id = ?
          ORDER BY r.name_label ASC, r.canonical_match_key ASC
        `,
      )
      .all(areaId, run.run_id) as JoinedRow[]
    const unmatched = db
      .prepare(
        `
          SELECT canonical_match_key, name_label, osm_relation_id, admin_level, map_bbox_json
          FROM unmatched_rows
          WHERE area_id = ? AND run_id = ?
          ORDER BY name_label ASC, canonical_match_key ASC
        `,
      )
      .all(areaId, run.run_id) as UnmatchedDbRow[]
    const { sourceMetadata, ogcInspectSources } = sourceMetadataForRun(db, areaId, run.run_id)
    return {
      area: areaId,
      generatedAt: run.generated_at,
      metricsCrs: run.metrics_crs,
      hasPmtiles: run.has_pmtiles === 1,
      hasUnmatchedPmtiles: run.has_unmatched_pmtiles === 1,
      tippecanoeLayer: run.tippecanoe_layer,
      rows: rows.map(reportRowFromDb),
      unmatchedOsm: unmatched.map(unmatchedRowFromDb),
      sourceMetadata,
      ogcInspectSources,
    }
  })
}

export function loadFeatureForArea(
  runtimeRoot: string,
  areaId: string,
  featureKey: string,
): ComparisonForReport | null {
  return withReadonlyDb(runtimeRoot, (db) => {
    const run = latestRunForArea(db, areaId)
    if (!run) return null
    const row = db
      .prepare(
        `
          SELECT
            r.canonical_match_key, r.name_label, r.category, r.osm_relation_id, r.map_bbox_json,
            r.iou, r.area_diff_pct, r.symmetric_diff_pct, r.hausdorff_m, r.official_area_m2, r.osm_area_m2,
            p.official_props_json, p.osm_props_json, p.official_for_edit_path
          FROM area_rows r
          LEFT JOIN area_row_props p
            ON p.area_id = r.area_id AND p.run_id = r.run_id AND p.canonical_match_key = r.canonical_match_key
          WHERE r.area_id = ? AND r.run_id = ? AND r.canonical_match_key = ?
          LIMIT 1
        `,
      )
      .get(areaId, run.run_id, featureKey) as JoinedRow | null
    if (!row) return null
    const { sourceMetadata, ogcInspectSources } = sourceMetadataForRun(db, areaId, run.run_id)
    return {
      area: areaId,
      generatedAt: run.generated_at,
      metricsCrs: run.metrics_crs,
      hasPmtiles: run.has_pmtiles === 1,
      hasUnmatchedPmtiles: run.has_unmatched_pmtiles === 1,
      tippecanoeLayer: run.tippecanoe_layer,
      rows: [reportRowFromDb(row)],
      unmatchedOsm: [],
      sourceMetadata,
      ogcInspectSources,
    }
  })
}

export function loadUnmatchedForArea(
  runtimeRoot: string,
  areaId: string,
): ComparisonForReport | null {
  return withReadonlyDb(runtimeRoot, (db) => {
    const run = latestRunForArea(db, areaId)
    if (!run) return null
    const rows = db
      .prepare(
        `
          SELECT canonical_match_key, name_label, osm_relation_id, admin_level, map_bbox_json
          FROM unmatched_rows
          WHERE area_id = ? AND run_id = ?
          ORDER BY name_label ASC, canonical_match_key ASC
        `,
      )
      .all(areaId, run.run_id) as UnmatchedDbRow[]
    const { sourceMetadata, ogcInspectSources } = sourceMetadataForRun(db, areaId, run.run_id)
    return {
      area: areaId,
      generatedAt: run.generated_at,
      metricsCrs: run.metrics_crs,
      hasPmtiles: run.has_pmtiles === 1,
      hasUnmatchedPmtiles: run.has_unmatched_pmtiles === 1,
      tippecanoeLayer: run.tippecanoe_layer,
      rows: [],
      unmatchedOsm: rows.map(unmatchedRowFromDb),
      sourceMetadata,
      ogcInspectSources,
    }
  })
}

export function loadSnapshotsForArea(runtimeRoot: string, areaId: string): SnapshotsJson | null {
  return withReadonlyDb(runtimeRoot, (db) => {
    const runs = db
      .prepare(
        `
          SELECT run_id, mean_iou, matched_count, official_only_count, unmatched_count, metrics_crs
          FROM area_runs
          WHERE area_id = ?
          ORDER BY run_id ASC
        `,
      )
      .all(areaId) as {
      run_id: string
      mean_iou: number
      matched_count: number
      official_only_count: number
      unmatched_count: number
      metrics_crs: string
    }[]
    if (runs.length === 0) return null
    const metricsCrs = runs[0]?.metrics_crs ?? 'EPSG:4326'
    return {
      area: areaId,
      metricsCrs,
      runs: runs.map((r) => ({
        id: r.run_id,
        summary: {
          totalRows: r.matched_count + r.official_only_count,
          meanIou: r.mean_iou,
          matched: r.matched_count,
          unmatchedOsm: r.unmatched_count,
        },
      })),
    }
  })
}
