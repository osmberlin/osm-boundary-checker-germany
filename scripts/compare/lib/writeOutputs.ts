import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { area, bbox, cleanCoords, featureCollection, simplify, truncate } from '@turf/turf'
import { geojson } from 'flatgeobuf'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import type {
  ComparisonFilterConfigSummary,
  ComparisonForReport,
  FeatureDetailShard,
  ReportRow as StaticReportRow,
  UnmatchedOsmReportRow as StaticUnmatchedOsmRow,
} from '../../shared/comparisonPayload.ts'
import {
  assignOfficialForEditStems,
  officialForEditGeojsonBasename,
} from '../../shared/officialForEditGeojson.ts'
import type { OgcWfsInspectSource } from '../../shared/ogcInspectSources.ts'
import type { ComparisonSourceMetadata, SourceMetadataSide } from '../../shared/sourceMetadata.ts'
import type {
  CompareInstrumentation,
  ComparePhaseLogger,
  CompareRow,
  UnmatchedOsmRow,
} from './compare.ts'
import { computeMeanIou } from './metrics.ts'
import { runTippecanoe, TIPPECANOE_LAYER } from './runTippecanoe.ts'
import { calculateDiffBatchWithRust } from './rustGeomSidecar.ts'

const TABLE_JSON = 'comparison_table.json'
const PMTILES = 'comparison.pmtiles'
const PMTILES_UNMATCHED = 'unmatched.pmtiles'
const BUILD_DIR = '_build'
const BUILD_FGB = 'geometries.fgb'
const OFFICIAL_FOR_EDIT_DIR = 'official_for_edit'
const OFFICIAL_FOR_EDIT_SIMPLIFY_METERS = 2.5
const OFFICIAL_FOR_EDIT_SIMPLIFY_DEGREES = OFFICIAL_FOR_EDIT_SIMPLIFY_METERS / 111_320
const OFFICIAL_FOR_EDIT_COORD_PRECISION = 6

export type OverpassBoundaryTag = 'administrative' | 'postal_code'

function compactOfficialSource(
  side: SourceMetadataSide | null | undefined,
): Record<string, string> | undefined {
  if (!side) return undefined
  const out: Record<string, string> = {}
  for (const k of [
    'provider',
    'dataset',
    'layer',
    'sourcePublicUrl',
    'sourceDownloadUrl',
    'sourcePublishedAt',
    'sourceUpdatedAt',
    'sourceDateSource',
    'downloadedAt',
    'licenseId',
    'licenseLabel',
    'licenseSourceUrl',
    'osmCompatibility',
    'osmCompatibilitySourceUrl',
    'osmCompatibilityComment',
    'note',
    'license',
  ] as const) {
    const v = side[k]
    if (v != null && String(v).trim() !== '') out[k] = String(v)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function flattenOfficialSourceForProperties(
  officialMeta: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!officialMeta) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(officialMeta)) {
    out[`officialSource.${key}`] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function writeOfficialForEditGeojson(
  outDir: string,
  rows: CompareRow[],
  sourceMetadata: ComparisonSourceMetadata,
  stemByKey: Map<string, string> | null,
) {
  const dir = join(outDir, OFFICIAL_FOR_EDIT_DIR)
  const tmpDir = `${dir}.tmp-${Date.now()}`
  rmSync(tmpDir, { recursive: true, force: true })
  if (stemByKey == null || stemByKey.size === 0) {
    rmSync(dir, { recursive: true, force: true })
    return
  }
  const officialMeta = flattenOfficialSourceForProperties(
    compactOfficialSource(sourceMetadata.official),
  )
  mkdirSync(tmpDir, { recursive: true })
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
        ...officialMeta,
      },
      geometry: normalizeOfficialForEditGeometry(geom),
    }
    const fileName = officialForEditGeojsonBasename(stem)
    writeFileSync(join(tmpDir, fileName), `${JSON.stringify(feature)}\n`, 'utf-8')
  }
  const oldDir = `${dir}.old-${Date.now()}`
  try {
    if (existsSync(dir)) renameSync(dir, oldDir)
    renameSync(tmpDir, dir)
  } finally {
    rmSync(oldDir, { recursive: true, force: true })
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

function normalizeOfficialForEditGeometry(geometry: Geometry): Geometry {
  const polygon = asPolygonFeature(geometry)
  if (!polygon) return geometry
  try {
    const simplified = simplify(polygon, {
      tolerance: OFFICIAL_FOR_EDIT_SIMPLIFY_DEGREES,
      highQuality: true,
      mutate: false,
    }) as Feature<Polygon | MultiPolygon>
    const cleaned = cleanCoords(simplified, { mutate: false }) as Feature<Polygon | MultiPolygon>
    const rounded = truncate(cleaned, {
      precision: OFFICIAL_FOR_EDIT_COORD_PRECISION,
      coordinates: 2,
      mutate: false,
    }) as Feature<Polygon | MultiPolygon>
    return rounded.geometry
  } catch {
    return geometry
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

function appendDiffFeaturesForRowWithPrecomputed(
  features: Feature[],
  r: CompareRow,
  precomputed: {
    externalDiff: Geometry | null
    osmDiff: Geometry | null
  },
) {
  const { canonicalMatchKey } = r
  if (precomputed.externalDiff) {
    const external = asPolygonFeature(precomputed.externalDiff)
    if (external) {
      pushDiffFeature(features, external, {
        featureId: canonicalMatchKey,
        boundarySource: 'external',
      })
    }
  }
  if (precomputed.osmDiff) {
    const osm = asPolygonFeature(precomputed.osmDiff)
    if (osm) {
      pushDiffFeature(features, osm, {
        featureId: canonicalMatchKey,
        boundarySource: 'osm',
      })
    }
  }
}

function buildGeometryFeatureCollection(
  rows: CompareRow[],
  phaseLogger?: ComparePhaseLogger,
  instrumentation?: CompareInstrumentation,
): FeatureCollection {
  const features: Feature[] = []
  console.log(`[writeOutputs] starting diff_rust rows=${rows.length}`)
  const tDiff = Date.now()
  instrumentation?.setInFlightPhase?.('diff')
  instrumentation?.checkpoint?.('before_diff_rust', { rows: rows.length })
  const rustDiffRows = calculateDiffBatchWithRust(
    rows.map((row) => ({
      category: row.category,
      canonicalMatchKey: row.canonicalMatchKey,
      officialGeometryWgs84: row.officialGeometryWgs84,
      osmGeometryWgs84: row.osmGeometryWgs84,
    })),
  )
  const rustDiffByKey = new Map(
    rustDiffRows.map((row) => [
      row.canonicalMatchKey,
      {
        externalDiff: row.externalDiff,
        osmDiff: row.osmDiff,
      },
    ]),
  )
  const diffMs = Date.now() - tDiff
  phaseLogger?.('diff', diffMs, { rows: rustDiffRows.length })
  console.log(`[writeOutputs] diff_rust done rows=${rustDiffRows.length} elapsedMs=${diffMs}`)
  instrumentation?.checkpoint?.('after_diff_rust', {
    rows: rustDiffRows.length,
    elapsedMs: diffMs,
  })

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
    const precomputed = rustDiffByKey.get(r.canonicalMatchKey)
    if (!precomputed) {
      throw new Error(`Missing rust diff result for key "${r.canonicalMatchKey}"`)
    }
    appendDiffFeaturesForRowWithPrecomputed(features, r, precomputed)
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

function removeObsoleteOutputFiles(outDir: string) {
  const obsolete = ['comparison_for_report.json', 'detailed_results.csv', 'comparison_report.md']
  for (const f of obsolete) {
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

function buildStaticPayloadBase(
  areaFolder: string,
  displayName: string,
  titlePrefix: string,
  generatedAt: string,
  metricsCrs: string,
  overpassBoundaryTag: OverpassBoundaryTag,
  hasPmtiles: boolean,
  hasUnmatchedPmtiles: boolean,
  sourceMetadata: ComparisonSourceMetadata,
  filterConfigSummary: ComparisonFilterConfigSummary | null,
  ogcInspectSources: OgcWfsInspectSource[],
): Omit<ComparisonForReport, 'rows' | 'unmatchedOsm'> {
  const out: Omit<ComparisonForReport, 'rows' | 'unmatchedOsm'> = {
    area: areaFolder,
    displayName,
    titlePrefix,
    generatedAt,
    metricsCrs,
    overpassBoundaryTag,
    hasPmtiles,
    hasUnmatchedPmtiles,
    tippecanoeLayer: TIPPECANOE_LAYER,
    sourceMetadata: {
      official: sourceMetadata.official,
      osm: sourceMetadata.osm,
    },
  }
  if (filterConfigSummary != null) out.filterConfigSummary = filterConfigSummary
  if (ogcInspectSources.length > 0) out.ogcInspectSources = ogcInspectSources
  return out
}

function comparisonRowToPayload(
  row: CompareRow,
  stemByKeyForOfficial: Map<string, string> | null,
): StaticReportRow {
  const editStem = stemByKeyForOfficial?.get(row.canonicalMatchKey)
  const officialForEditPath =
    row.officialGeometryWgs84 && editStem != null
      ? `output/${OFFICIAL_FOR_EDIT_DIR}/${officialForEditGeojsonBasename(editStem)}`
      : null
  return {
    canonicalMatchKey: row.canonicalMatchKey,
    nameLabel: row.nameLabel,
    category: row.category,
    osmRelationId: row.osmRelationId,
    metrics: row.metrics,
    mapBbox: mapBboxForRow(row),
    officialForEditPath,
    officialProperties: row.officialProperties,
    osmProperties: row.osmProperties,
  }
}

function unmatchedRowToPayload(row: UnmatchedOsmRow): StaticUnmatchedOsmRow {
  return {
    canonicalMatchKey: row.canonicalMatchKey,
    nameLabel: row.nameLabel,
    osmRelationId: row.osmRelationId,
    adminLevel: row.adminLevel,
    mapBbox: mapBboxForGeometry(row.osmGeometryWgs84),
  }
}

function writeStaticJson(path: string, body: unknown): void {
  const tmpPath = `${path}.tmp`
  writeFileSync(tmpPath, `${JSON.stringify(body)}\n`, 'utf-8')
  renameSync(tmpPath, path)
}

function writePrettyJson(path: string, body: unknown): void {
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`, 'utf-8')
}

function updateSnapshotsFile(
  areaPath: string,
  snapshotId: string,
  metricsCrs: string,
  meanIou: number,
  matchedCount: number,
  officialOnlyCount: number,
  unmatchedOsmCount: number,
) {
  const snapshotsPath = join(areaPath, 'snapshots.json')
  let snapshots: {
    area: string
    metricsCrs: string
    runs: Array<{
      id: string
      summary: { totalRows: number; meanIou: number; matched: number; unmatchedOsm: number }
    }>
  } = {
    area: areaPath.split('/').pop() ?? '',
    metricsCrs,
    runs: [],
  }
  if (existsSync(snapshotsPath)) {
    try {
      const parsed = JSON.parse(readFileSync(snapshotsPath, 'utf-8')) as typeof snapshots
      if (parsed && Array.isArray(parsed.runs)) snapshots = parsed
    } catch {
      // Rebuild snapshots file when parsing fails.
    }
  }
  snapshots.metricsCrs = metricsCrs
  const runSummary = {
    id: snapshotId,
    summary: {
      totalRows: matchedCount + officialOnlyCount,
      meanIou,
      matched: matchedCount,
      unmatchedOsm: unmatchedOsmCount,
    },
  }
  const nextRuns = (snapshots.runs ?? []).filter((r) => r.id !== snapshotId)
  nextRuns.push(runSummary)
  nextRuns.sort((a, b) => a.id.localeCompare(b.id))
  snapshots.runs = nextRuns
  writePrettyJson(snapshotsPath, snapshots)
}

export function writeOutputs(
  areaPath: string,
  areaFolder: string,
  displayName: string,
  titlePrefix: string,
  rows: CompareRow[],
  unmatchedOsm: UnmatchedOsmRow[],
  metricsCrs: string,
  overpassBoundaryTag: OverpassBoundaryTag,
  sourceMetadata: ComparisonSourceMetadata,
  filterConfigSummary: ComparisonFilterConfigSummary | null = null,
  ogcInspectSources: OgcWfsInspectSource[] = [],
  phaseLogger?: ComparePhaseLogger,
  instrumentation?: CompareInstrumentation,
): { snapshotId: string } {
  const outDir = join(areaPath, 'output')
  const buildDir = join(outDir, BUILD_DIR)
  mkdirSync(outDir, { recursive: true })

  const snapshotId = todayStamp()
  const generatedAt = new Date().toISOString()

  const matched = rows.filter((r) => r.category === 'matched')
  const officialOnly = rows.filter((r) => r.category === 'official_only')
  const meanIou = computeMeanIou(rows)

  const geometryFc = buildGeometryFeatureCollection(rows, phaseLogger, instrumentation)
  const fgbPath = join(buildDir, BUILD_FGB)
  const pmtilesPath = join(outDir, PMTILES)
  const unmatchedFgbPath = join(buildDir, 'unmatched.fgb')
  const unmatchedPmtilesPath = join(outDir, PMTILES_UNMATCHED)

  removeObsoleteOutputFiles(outDir)

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
      console.log(`[writeOutputs] starting tippecanoe_main features=${geometryFc.features.length}`)
      const tTippecanoeMain = Date.now()
      instrumentation?.setInFlightPhase?.('tippecanoe_main')
      instrumentation?.checkpoint?.('before_tippecanoe_main', {
        features: geometryFc.features.length,
      })
      runTippecanoe(fgbPath, pmtilesPath)
      const tippecanoeMs = Date.now() - tTippecanoeMain
      phaseLogger?.('tippecanoe_main', tippecanoeMs, {
        features: geometryFc.features.length,
      })
      console.log(
        `[writeOutputs] tippecanoe_main done features=${geometryFc.features.length} elapsedMs=${tippecanoeMs}`,
      )
      instrumentation?.checkpoint?.('after_tippecanoe_main', {
        features: geometryFc.features.length,
        elapsedMs: tippecanoeMs,
      })
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
      const tTippecanoeUnmatched = Date.now()
      instrumentation?.setInFlightPhase?.('tippecanoe_unmatched')
      instrumentation?.checkpoint?.('before_tippecanoe_unmatched', {
        features: unmatchedFc.features.length,
      })
      runTippecanoe(unmatchedFgbPath, unmatchedPmtilesPath)
      phaseLogger?.('tippecanoe_unmatched', Date.now() - tTippecanoeUnmatched, {
        features: unmatchedFc.features.length,
      })
      instrumentation?.checkpoint?.('after_tippecanoe_unmatched', {
        features: unmatchedFc.features.length,
        elapsedMs: Date.now() - tTippecanoeUnmatched,
      })
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

  const base = buildStaticPayloadBase(
    areaFolder,
    displayName,
    titlePrefix,
    generatedAt,
    metricsCrs,
    overpassBoundaryTag,
    hasPmtiles,
    hasUnmatchedPmtiles,
    sourceMetadata,
    filterConfigSummary,
    ogcInspectSources,
  )
  const payloadRows = rows.map((row) => comparisonRowToPayload(row, stemByKeyForOfficial))
  const payloadUnmatched = unmatchedOsm.map(unmatchedRowToPayload)

  const tWritePayloads = Date.now()
  instrumentation?.setInFlightPhase?.('write_payloads')
  instrumentation?.checkpoint?.('before_write_payloads', {
    rows: payloadRows.length,
    unmatched: payloadUnmatched.length,
  })
  writeStaticJson(join(outDir, TABLE_JSON), {
    ...base,
    rows: payloadRows,
    unmatchedOsm: payloadUnmatched,
  } satisfies ComparisonForReport)

  const featureDir = join(outDir, 'features')
  const featureTmp = `${featureDir}.tmp-${Date.now()}`
  rmSync(featureTmp, { recursive: true, force: true })
  let featureShardCount = 0
  const shardProgressInterval = 1000
  mkdirSync(featureTmp, { recursive: true })
  for (const row of payloadRows) {
    featureShardCount++
    writeStaticJson(join(featureTmp, `${encodeURIComponent(row.canonicalMatchKey)}.json`), {
      row,
    } satisfies FeatureDetailShard)
    if (
      featureShardCount % shardProgressInterval === 0 ||
      featureShardCount === payloadRows.length
    ) {
      instrumentation?.progress?.('write_feature_shards', featureShardCount, payloadRows.length, {
        elapsedMs: Date.now() - tWritePayloads,
      })
    }
  }
  const featureOld = `${featureDir}.old-${Date.now()}`
  try {
    if (existsSync(featureDir)) renameSync(featureDir, featureOld)
    renameSync(featureTmp, featureDir)
  } finally {
    rmSync(featureOld, { recursive: true, force: true })
    rmSync(featureTmp, { recursive: true, force: true })
  }

  updateSnapshotsFile(
    areaPath,
    snapshotId,
    metricsCrs,
    meanIou,
    matched.length,
    officialOnly.length,
    unmatchedOsm.length,
  )
  phaseLogger?.('write_payloads', Date.now() - tWritePayloads, {
    rows: payloadRows.length,
    unmatched: payloadUnmatched.length,
    featureShards: featureShardCount,
  })
  instrumentation?.checkpoint?.('after_write_payloads', {
    rows: payloadRows.length,
    unmatched: payloadUnmatched.length,
    featureShards: featureShardCount,
    elapsedMs: Date.now() - tWritePayloads,
  })
  instrumentation?.setInFlightPhase?.(null)

  return { snapshotId }
}
