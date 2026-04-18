import { existsSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { area, bbox, difference, featureCollection } from '@turf/turf'
import { geojson } from 'flatgeobuf'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import {
  assignOfficialForEditStems,
  officialForEditGeojsonBasename,
} from '../../shared/officialForEditGeojson.ts'
import type { OgcWfsInspectSource } from '../../shared/ogcInspectSources.ts'
import { ensureRuntimeDatabase } from '../../shared/runtimeDb.ts'
import type { ComparisonSourceMetadata, SourceMetadataSide } from '../../shared/sourceMetadata.ts'
import type { CompareRow, UnmatchedOsmRow } from './compare.ts'
import { computeMeanIou } from './metrics.ts'
import { runTippecanoe, TIPPECANOE_LAYER } from './runTippecanoe.ts'

const TABLE_JSON = 'comparison_table.json'
const PMTILES = 'comparison.pmtiles'
const PMTILES_UNMATCHED = 'unmatched.pmtiles'
const BUILD_DIR = '_build'
const BUILD_FGB = 'geometries.fgb'
const OFFICIAL_FOR_EDIT_DIR = 'official_for_edit'

function compactOfficialSource(
  side: SourceMetadataSide | null | undefined,
): Record<string, string> | undefined {
  if (!side) return undefined
  const out: Record<string, string> = {}
  for (const k of [
    'provider',
    'dataset',
    'layer',
    'sourceUrl',
    'downloadedAt',
    'note',
    'license',
  ] as const) {
    const v = side[k]
    if (v != null && String(v).trim() !== '') out[k] = String(v)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function writeOfficialForEditGeojson(
  outDir: string,
  rows: CompareRow[],
  sourceMetadata: ComparisonSourceMetadata | null,
  stemByKey: Map<string, string> | null,
) {
  const dir = join(outDir, OFFICIAL_FOR_EDIT_DIR)
  rmSync(dir, { recursive: true, force: true })
  if (stemByKey == null || stemByKey.size === 0) return
  const officialMeta = compactOfficialSource(sourceMetadata?.official ?? null)
  mkdirSync(dir, { recursive: true })
  for (const r of rows) {
    const geom = r.officialGeometryWgs84
    if (!geom) continue
    const stem = stemByKey.get(r.canonicalMatchKey)
    if (stem == null) continue
    const feature = {
      type: 'Feature' as const,
      properties: {
        featureId: r.canonicalMatchKey,
        nameLabel: r.nameLabel,
        boundarySource: 'external' as const,
        ...(officialMeta ? { officialSource: officialMeta } : {}),
      },
      geometry: geom,
    }
    const fileName = officialForEditGeojsonBasename(stem)
    writeFileSync(join(dir, fileName), `${JSON.stringify(feature, null, 2)}\n`, 'utf-8')
  }
}

function todayStamp(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mapBboxForGeometry(g: Geometry | null): [number, number, number, number] | null {
  if (!g) return null
  const parts: Feature[] = [
    {
      type: 'Feature',
      properties: {},
      geometry: g,
    },
  ]
  const b = bbox(featureCollection(parts))
  return b as [number, number, number, number]
}

function mapBboxForRow(r: CompareRow): [number, number, number, number] | null {
  const parts: Feature[] = []
  if (r.officialGeometryWgs84) {
    parts.push({
      type: 'Feature',
      properties: {},
      geometry: r.officialGeometryWgs84,
    })
  }
  if (r.osmGeometryWgs84) {
    parts.push({
      type: 'Feature',
      properties: {},
      geometry: r.osmGeometryWgs84,
    })
  }
  if (parts.length === 0) return null
  const b = bbox(featureCollection(parts))
  return b as [number, number, number, number]
}

const MIN_DIFF_AREA_M2 = 1e-6

function asPolygonFeature(geometry: Geometry): Feature<Polygon | MultiPolygon> | null {
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null
  return { type: 'Feature', properties: {}, geometry }
}

function pushDiffFeature(
  features: Feature[],
  diff: Feature<Polygon | MultiPolygon> | null | undefined,
  props: { featureId: string; boundarySource: 'external' | 'osm' },
) {
  if (!diff?.geometry) return
  if (area(diff) < MIN_DIFF_AREA_M2) return
  features.push({
    type: 'Feature',
    properties: { ...props, mapRole: 'diff' },
    geometry: diff.geometry,
  })
}

function appendDiffFeaturesForRow(features: Feature[], r: CompareRow) {
  const { category, canonicalMatchKey, officialGeometryWgs84, osmGeometryWgs84 } = r

  if (category === 'matched' && officialGeometryWgs84 && osmGeometryWgs84) {
    const off = asPolygonFeature(officialGeometryWgs84)
    const osm = asPolygonFeature(osmGeometryWgs84)
    if (!off || !osm) return
    try {
      // Turf 7+: difference(featureCollection([a, b])) = area of a minus b
      pushDiffFeature(features, difference(featureCollection([off, osm])), {
        featureId: canonicalMatchKey,
        boundarySource: 'external',
      })
      pushDiffFeature(features, difference(featureCollection([osm, off])), {
        featureId: canonicalMatchKey,
        boundarySource: 'osm',
      })
    } catch {
      /* invalid topology for boolean op */
    }
    return
  }

  if (category === 'official_only' && officialGeometryWgs84) {
    const off = asPolygonFeature(officialGeometryWgs84)
    if (off) {
      pushDiffFeature(features, off, {
        featureId: canonicalMatchKey,
        boundarySource: 'external',
      })
    }
  }
}

function buildGeometryFeatureCollection(rows: CompareRow[]): FeatureCollection {
  const features: Feature[] = []
  for (const r of rows) {
    if (r.officialGeometryWgs84) {
      features.push({
        type: 'Feature',
        properties: {
          featureId: r.canonicalMatchKey,
          boundarySource: 'external',
          mapRole: 'overlay',
        },
        geometry: r.officialGeometryWgs84,
      })
    }
    if (r.osmGeometryWgs84) {
      features.push({
        type: 'Feature',
        properties: {
          featureId: r.canonicalMatchKey,
          boundarySource: 'osm',
          mapRole: 'overlay',
        },
        geometry: r.osmGeometryWgs84,
      })
    }
    appendDiffFeaturesForRow(features, r)
  }
  return { type: 'FeatureCollection', features }
}

function buildUnmatchedOsmFeatureCollection(unmatched: UnmatchedOsmRow[]): FeatureCollection {
  const features: Feature[] = []
  for (const u of unmatched) {
    if (!u.osmGeometryWgs84) continue
    features.push({
      type: 'Feature',
      properties: {
        featureId: u.canonicalMatchKey,
        boundarySource: 'osm' as const,
        mapRole: 'overlay' as const,
      },
      geometry: u.osmGeometryWgs84,
    })
  }
  return { type: 'FeatureCollection', features }
}

function removeLegacyOutputFiles(outDir: string) {
  const legacy = ['comparison_for_report.json', 'detailed_results.csv', 'comparison_report.md']
  for (const f of legacy) {
    const p = join(outDir, f)
    if (existsSync(p)) {
      try {
        unlinkSync(p)
      } catch {
        /* ignore */
      }
    }
  }
}

function removeLegacyJsonOutputs(outDir: string, areaPath: string) {
  for (const p of [join(outDir, TABLE_JSON), join(areaPath, 'snapshots.json')]) {
    if (!existsSync(p)) continue
    try {
      unlinkSync(p)
    } catch {
      /* ignore */
    }
  }
}

function unmatchedRowsForTableDoc(unmatchedOsm: UnmatchedOsmRow[]): Record<string, unknown>[] {
  return unmatchedOsm.map((u) => ({
    canonicalMatchKey: u.canonicalMatchKey,
    nameLabel: u.nameLabel,
    osmRelationId: u.osmRelationId,
    adminLevel: u.adminLevel,
    mapBbox: mapBboxForGeometry(u.osmGeometryWgs84),
  }))
}

export function writeOutputs(
  workspaceRoot: string,
  runtimeRoot: string,
  areaPath: string,
  areaFolder: string,
  rows: CompareRow[],
  unmatchedOsm: UnmatchedOsmRow[],
  metricsCrs: string,
  sourceMetadata: ComparisonSourceMetadata | null = null,
  ogcInspectSources: OgcWfsInspectSource[] = [],
): { snapshotId: string } {
  const outDir = join(areaPath, 'output')
  const buildDir = join(outDir, BUILD_DIR)
  mkdirSync(outDir, { recursive: true })

  const snapshotId = todayStamp()
  const generatedAt = new Date().toISOString()

  const matched = rows.filter((r) => r.category === 'matched')
  const officialOnly = rows.filter((r) => r.category === 'official_only')
  const meanIou = computeMeanIou(rows)

  const geometryFc = buildGeometryFeatureCollection(rows)
  const fgbPath = join(buildDir, BUILD_FGB)
  const pmtilesPath = join(outDir, PMTILES)
  const unmatchedFgbPath = join(buildDir, 'unmatched.fgb')
  const unmatchedPmtilesPath = join(outDir, PMTILES_UNMATCHED)

  removeLegacyOutputFiles(outDir)

  const withOfficialRows = rows.filter((r) => r.officialGeometryWgs84 != null)
  const stemByKeyForOfficial =
    withOfficialRows.length > 0
      ? assignOfficialForEditStems(withOfficialRows.map((r) => r.canonicalMatchKey))
      : null
  writeOfficialForEditGeojson(outDir, rows, sourceMetadata, stemByKeyForOfficial)

  let hasPmtiles = false
  if (geometryFc.features.length > 0) {
    mkdirSync(buildDir, { recursive: true })
    writeFileSync(fgbPath, geojson.serialize(geometryFc))
    try {
      runTippecanoe(fgbPath, pmtilesPath)
      hasPmtiles = true
    } finally {
      try {
        rmSync(fgbPath, { force: true })
      } catch {
        /* ignore */
      }
    }
  } else {
    if (existsSync(pmtilesPath)) {
      try {
        unlinkSync(pmtilesPath)
      } catch {
        /* ignore */
      }
    }
  }

  const unmatchedFc = buildUnmatchedOsmFeatureCollection(unmatchedOsm)
  let hasUnmatchedPmtiles = false
  if (unmatchedFc.features.length > 0) {
    mkdirSync(buildDir, { recursive: true })
    writeFileSync(unmatchedFgbPath, geojson.serialize(unmatchedFc))
    try {
      runTippecanoe(unmatchedFgbPath, unmatchedPmtilesPath)
      hasUnmatchedPmtiles = true
    } finally {
      try {
        rmSync(unmatchedFgbPath, { force: true })
      } catch {
        /* ignore */
      }
      try {
        rmSync(buildDir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  } else {
    if (existsSync(unmatchedPmtilesPath)) {
      try {
        unlinkSync(unmatchedPmtilesPath)
      } catch {
        /* ignore */
      }
    }
    try {
      rmSync(buildDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }

  const unmatchedTable = unmatchedRowsForTableDoc(unmatchedOsm)
  persistRunDataToDb(
    workspaceRoot,
    runtimeRoot,
    areaFolder,
    snapshotId,
    generatedAt,
    metricsCrs,
    hasPmtiles,
    hasUnmatchedPmtiles,
    meanIou,
    matched.length,
    officialOnly.length,
    unmatchedOsm.length,
    rows,
    unmatchedTable,
    stemByKeyForOfficial,
    sourceMetadata,
    ogcInspectSources,
  )
  removeLegacyJsonOutputs(outDir, areaPath)

  return { snapshotId }
}

function persistRunDataToDb(
  workspaceRoot: string,
  runtimeRoot: string,
  areaFolder: string,
  snapshotId: string,
  generatedAt: string,
  metricsCrs: string,
  hasPmtiles: boolean,
  hasUnmatchedPmtiles: boolean,
  meanIou: number,
  matchedCount: number,
  officialOnlyCount: number,
  unmatchedOsmCount: number,
  rows: CompareRow[],
  unmatchedTable: Record<string, unknown>[],
  stemByKeyForOfficial: Map<string, string> | null,
  sourceMetadata: ComparisonSourceMetadata | null,
  ogcInspectSources: OgcWfsInspectSource[],
) {
  const db = ensureRuntimeDatabase(runtimeRoot, workspaceRoot)
  const writeTx = db.transaction(() => {
    db.prepare(
      `
          INSERT INTO areas (area_id, display_name, metrics_crs, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(area_id) DO UPDATE SET
            display_name = excluded.display_name,
            metrics_crs = excluded.metrics_crs,
            updated_at = excluded.updated_at
        `,
    ).run(areaFolder, areaFolder, metricsCrs, generatedAt)
    db.prepare(
      `
          INSERT INTO area_runs (
            area_id, run_id, generated_at, metrics_crs,
            has_pmtiles, has_unmatched_pmtiles, tippecanoe_layer,
            mean_iou, matched_count, official_only_count, unmatched_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(area_id, run_id) DO UPDATE SET
            generated_at = excluded.generated_at,
            metrics_crs = excluded.metrics_crs,
            has_pmtiles = excluded.has_pmtiles,
            has_unmatched_pmtiles = excluded.has_unmatched_pmtiles,
            tippecanoe_layer = excluded.tippecanoe_layer,
            mean_iou = excluded.mean_iou,
            matched_count = excluded.matched_count,
            official_only_count = excluded.official_only_count,
            unmatched_count = excluded.unmatched_count
        `,
    ).run(
      areaFolder,
      snapshotId,
      generatedAt,
      metricsCrs,
      hasPmtiles ? 1 : 0,
      hasUnmatchedPmtiles ? 1 : 0,
      TIPPECANOE_LAYER,
      meanIou,
      matchedCount,
      officialOnlyCount,
      unmatchedOsmCount,
    )

    db.prepare(`DELETE FROM area_rows WHERE area_id = ? AND run_id = ?`).run(areaFolder, snapshotId)
    db.prepare(`DELETE FROM area_row_props WHERE area_id = ? AND run_id = ?`).run(
      areaFolder,
      snapshotId,
    )
    db.prepare(`DELETE FROM unmatched_rows WHERE area_id = ? AND run_id = ?`).run(
      areaFolder,
      snapshotId,
    )
    db.prepare(`DELETE FROM source_metadata WHERE area_id = ? AND run_id = ?`).run(
      areaFolder,
      snapshotId,
    )

    const insertRow = db.prepare(`
      INSERT INTO area_rows (
        area_id, run_id, canonical_match_key, name_label, category, osm_relation_id, map_bbox_json,
        iou, area_diff_pct, symmetric_diff_pct, hausdorff_m, official_area_m2, osm_area_m2
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertProps = db.prepare(`
      INSERT INTO area_row_props (
        area_id, run_id, canonical_match_key, official_props_json, osm_props_json, official_for_edit_path
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const r of rows) {
      const editStem = stemByKeyForOfficial?.get(r.canonicalMatchKey)
      const officialForEditPath =
        r.officialGeometryWgs84 && editStem != null
          ? `output/${OFFICIAL_FOR_EDIT_DIR}/${officialForEditGeojsonBasename(editStem)}`
          : null
      insertRow.run(
        areaFolder,
        snapshotId,
        r.canonicalMatchKey,
        r.nameLabel,
        r.category,
        r.osmRelationId,
        toDbJson(mapBboxForRow(r)),
        r.metrics?.iou ?? null,
        r.metrics?.areaDiffPct ?? null,
        r.metrics?.symmetricDiffPct ?? null,
        r.metrics?.hausdorffM ?? null,
        r.metrics?.officialAreaM2 ?? null,
        r.metrics?.osmAreaM2 ?? null,
      )
      insertProps.run(
        areaFolder,
        snapshotId,
        r.canonicalMatchKey,
        toDbJson(r.officialProperties),
        toDbJson(r.osmProperties),
        officialForEditPath,
      )
    }

    const insertUnmatched = db.prepare(`
      INSERT INTO unmatched_rows (
        area_id, run_id, canonical_match_key, name_label, osm_relation_id, admin_level, map_bbox_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    for (const row of unmatchedTable) {
      const data = row as {
        canonicalMatchKey: string
        nameLabel: string
        osmRelationId: string
        adminLevel: string | null
        mapBbox: [number, number, number, number] | null
      }
      insertUnmatched.run(
        areaFolder,
        snapshotId,
        data.canonicalMatchKey,
        data.nameLabel,
        data.osmRelationId,
        data.adminLevel,
        toDbJson(data.mapBbox),
      )
    }

    if (sourceMetadata != null || ogcInspectSources.length > 0) {
      db.prepare(
        `
          INSERT INTO source_metadata (area_id, run_id, official_json, osm_json, ogc_sources_json)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run(
        areaFolder,
        snapshotId,
        toDbJson(sourceMetadata?.official ?? null),
        toDbJson(sourceMetadata?.osm ?? null),
        toDbJson(ogcInspectSources),
      )
    }
  })
  try {
    writeTx()
  } finally {
    db.close()
  }
}

function toDbJson(value: unknown): string | null {
  if (value == null) return null
  return JSON.stringify(value)
}
