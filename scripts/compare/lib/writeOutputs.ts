import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { area, bbox, difference, featureCollection } from '@turf/turf'
import { geojson } from 'flatgeobuf'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import {
  assignOfficialForEditStems,
  officialForEditGeojsonBasename,
} from '../../shared/officialForEditGeojson.ts'
import type { OgcWfsInspectSource } from '../../shared/ogcInspectSources.ts'
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
  areaPath: string,
  areaFolder: string,
  rows: CompareRow[],
  unmatchedOsm: UnmatchedOsmRow[],
  metricsCrs: string,
  sourceMetadata: ComparisonSourceMetadata | null = null,
  ogcInspectSources: OgcWfsInspectSource[] = [],
): { snapshotId: string } {
  const outDir = join(areaPath, 'output')
  const histDir = join(areaPath, 'history')
  const buildDir = join(outDir, BUILD_DIR)
  mkdirSync(outDir, { recursive: true })
  mkdirSync(histDir, { recursive: true })

  const snapshotId = todayStamp()

  const matched = rows.filter((r) => r.category === 'matched')
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

  const tableDoc: Record<string, unknown> = {
    area: areaFolder,
    generatedAt: new Date().toISOString(),
    metricsCrs,
    hasPmtiles,
    hasUnmatchedPmtiles,
    tippecanoeLayer: TIPPECANOE_LAYER,
    unmatchedOsm: unmatchedTable,
    rows: rows.map((r) => {
      const editStem = stemByKeyForOfficial?.get(r.canonicalMatchKey)
      const row: Record<string, unknown> = {
        canonicalMatchKey: r.canonicalMatchKey,
        nameLabel: r.nameLabel,
        category: r.category,
        osmRelationId: r.osmRelationId,
        metrics: r.metrics
          ? {
              iou: r.metrics.iou,
              areaDiffPct: r.metrics.areaDiffPct,
              symmetricDiffPct: r.metrics.symmetricDiffPct,
              hausdorffM: r.metrics.hausdorffM,
              officialAreaM2: r.metrics.officialAreaM2,
              osmAreaM2: r.metrics.osmAreaM2,
            }
          : null,
        mapBbox: mapBboxForRow(r),
        officialProperties: r.officialProperties,
        osmProperties: r.osmProperties,
        officialForEditPath:
          r.officialGeometryWgs84 && editStem != null
            ? `output/${OFFICIAL_FOR_EDIT_DIR}/${officialForEditGeojsonBasename(editStem)}`
            : null,
      }
      return row
    }),
  }

  if (sourceMetadata) {
    tableDoc.sourceMetadata = sourceMetadata
  }
  if (ogcInspectSources.length > 0) {
    tableDoc.ogcInspectSources = ogcInspectSources
  }

  const tablePathOut = join(outDir, TABLE_JSON)
  writeFileSync(tablePathOut, JSON.stringify(tableDoc, null, 2), 'utf-8')

  const histTablePath = join(histDir, `comparison_table_${snapshotId}.json`)
  const histRows = (tableDoc.rows as Record<string, unknown>[]).map((row) => ({
    ...row,
    officialForEditPath: null,
  }))
  const histTableDoc = {
    ...tableDoc,
    hasPmtiles: false,
    hasUnmatchedPmtiles: false,
    rows: histRows,
  }
  writeFileSync(histTablePath, JSON.stringify(histTableDoc, null, 2), 'utf-8')

  updateSnapshotsJson(
    areaPath,
    areaFolder,
    snapshotId,
    metricsCrs,
    meanIou,
    rows.length,
    matched.length,
    unmatchedOsm.length,
  )

  return { snapshotId }
}

type SnapshotEntry = {
  id: string
  tablePath: string
  /** Always null: historic runs keep stats only; tiles live under output/ for the latest run. */
  pmtilesPath: string | null
  summary: { totalRows: number; meanIou: number; matched: number; unmatchedOsm: number }
}

function updateSnapshotsJson(
  areaPath: string,
  areaFolder: string,
  snapshotId: string,
  metricsCrs: string,
  meanIou: number,
  rowCount: number,
  matchedCount: number,
  unmatchedOsmCount: number,
) {
  const path = join(areaPath, 'snapshots.json')
  let data: {
    area: string
    metricsCrs: string
    runs: SnapshotEntry[]
  } = {
    area: areaFolder,
    metricsCrs,
    runs: [],
  }
  if (existsSync(path)) {
    try {
      data = JSON.parse(readFileSync(path, 'utf-8')) as typeof data
    } catch {
      /* reset */
    }
  }
  const entry: SnapshotEntry = {
    id: snapshotId,
    tablePath: `history/comparison_table_${snapshotId}.json`,
    pmtilesPath: null,
    summary: {
      totalRows: rowCount,
      meanIou,
      matched: matchedCount,
      unmatchedOsm: unmatchedOsmCount,
    },
  }
  const rest = data.runs.filter((r) => r.id !== snapshotId)
  data.runs = [...rest, entry].sort((a, b) => a.id.localeCompare(b.id))
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}
