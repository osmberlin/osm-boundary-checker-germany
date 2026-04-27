import { existsSync } from 'node:fs'
import { join } from 'node:path'
import * as turf from '@turf/turf'
import type { BBox, Feature, Geometry, MultiPolygon, Point, Polygon } from 'geojson'
import type { DatasetConfig } from '../../shared/datasetConfig.ts'
import { datasetFolderPath } from '../../shared/datasetPaths.ts'
import type { BoundaryConfig } from './config.ts'
import { loadBoundaryConfig, osmFgbPathFromConfig } from './config.ts'
import { unionFeaturesByKey } from './geoMerge.ts'
import { loadFeatureCollection } from './loadFeatureCollection.ts'
import { type MetricResult } from './metrics.ts'
import { normalizeOfficialValue, normalizeOsmValue } from './normalizeGermanKey.ts'
import { officialPropertyToMatchKey } from './officialKeyTransposition.ts'
import { projectGeometry } from './projectGeometry.ts'
import { calculateMetricsBatchWithRust } from './rustGeomSidecar.ts'

export type CompareRow = {
  canonicalMatchKey: string
  nameLabel: string
  category: 'matched' | 'official_only'
  osmRelationId: string
  metrics: MetricResult | null
  officialGeometryWgs84: Geometry | null
  osmGeometryWgs84: Geometry | null
  /** GeoJSON properties from the merged official feature(s) for this key. */
  officialProperties: Record<string, unknown> | null
  /** GeoJSON properties from the merged OSM feature(s) for this key. */
  osmProperties: Record<string, unknown> | null
}

export type UnmatchedOsmRow = {
  canonicalMatchKey: string
  nameLabel: string
  osmRelationId: string
  adminLevel: string | null
  osmGeometryWgs84: Geometry | null
}

export type ComparePhaseLogger = (
  phase: string,
  durationMs: number,
  meta?: Record<string, unknown>,
) => void

export type CompareCheckpointLogger = (checkpoint: string, meta?: Record<string, unknown>) => void

export type CompareProgressLogger = (
  scope: string,
  current: number,
  total: number,
  meta?: Record<string, unknown>,
) => void

export type CompareInstrumentation = {
  checkpoint?: CompareCheckpointLogger
  progress?: CompareProgressLogger
  setInFlightPhase?: (phase: string | null) => void
}

function pickOsmRelationId(featureIds: string[], props?: Record<string, unknown> | null): string {
  const rel = featureIds.find((id) => id.startsWith('relation/'))
  if (rel) return rel.replace('relation/', '')
  const fallbackRel = resolveRelationId(props)
  if (fallbackRel) return fallbackRel
  return featureIds[0] ?? ''
}

function readAdminLevel(props: Record<string, unknown> | null): string | null {
  if (!props) return null
  const v = props.admin_level
  if (v == null) return null
  const s = String(v).trim()
  return s.length > 0 ? s : null
}

function mergeBboxes(a: BBox, b: BBox): BBox {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

function expandBbox(b: BBox, bufferDeg: number): BBox {
  return [b[0] - bufferDeg, b[1] - bufferDeg, b[2] + bufferDeg, b[3] + bufferDeg]
}

function bboxesOverlap(a: BBox, b: BBox): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}

function unionOfficialBbox(features: Feature[]): BBox | null {
  let acc: BBox | null = null
  for (const f of features) {
    if (!f.geometry) continue
    const bb = turf.bbox(f as Feature)
    acc = acc ? mergeBboxes(acc, bb) : bb
  }
  return acc
}

function filterOsmByOfficialBbox(
  osmFeatures: Feature[],
  officialUnion: BBox,
  bufferDeg: number,
): Feature[] {
  const pad = expandBbox(officialUnion, bufferDeg)
  return osmFeatures.filter((f) => {
    if (!f.geometry) return false
    const bb = turf.bbox(f as Feature)
    return bboxesOverlap(pad, bb)
  })
}

function toPolygonFeature(feature: Feature): Feature<Polygon | MultiPolygon> | null {
  const geometry = feature.geometry
  if (!geometry) return null
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null
  return feature as Feature<Polygon | MultiPolygon>
}

function hasCentroidInOfficialCoverage(
  osmFeature: Feature,
  officialCoverage: Feature<Polygon | MultiPolygon>[],
): boolean {
  if (!osmFeature.geometry) return false
  let centroid: Feature<Point>
  try {
    centroid = turf.centroid(osmFeature as Feature) as Feature<Point>
  } catch {
    return false
  }
  for (const official of officialCoverage) {
    if (turf.booleanPointInPolygon(centroid, official)) return true
  }
  return false
}

function filterOsmByOfficialCoverageCentroid(
  osmFeatures: Feature[],
  officialFeatures: Feature[],
): Feature[] {
  const officialCoverage = officialFeatures
    .map((feature) => toPolygonFeature(feature))
    .filter((feature): feature is Feature<Polygon | MultiPolygon> => feature != null)
  if (officialCoverage.length === 0) {
    throw new Error(
      'compare.osmScopeFilter=centroid_in_official_coverage requires official polygon geometries',
    )
  }
  return osmFeatures.filter((feature) => hasCentroidInOfficialCoverage(feature, officialCoverage))
}

function filterOsmByIgnoredRelationIds(
  osmFeatures: Feature[],
  ignoredRelationIds: Set<string>,
): Feature[] {
  return osmFeatures.filter((feature) => {
    const props = feature.properties as Record<string, unknown> | null | undefined
    const relId = resolveRelationId(props)
    return !relId || !ignoredRelationIds.has(relId)
  })
}

function filterOsmByAdminLevels(osmFeatures: Feature[], adminLevels: Set<string>): Feature[] {
  return osmFeatures.filter((feature) => {
    const props = feature.properties as Record<string, unknown> | null | undefined
    const adminLevel = readAdminLevel(props ?? null)
    return adminLevel != null && adminLevels.has(adminLevel)
  })
}

function parseRelationId(rawId: unknown): string | null {
  const id = typeof rawId === 'string' ? rawId.trim() : ''
  if (id.length === 0) return null
  if (/^\d+$/.test(id)) return id
  const slash = id.lastIndexOf('/')
  if (slash < 0) return null
  const tail = id.slice(slash + 1).trim()
  return /^\d+$/.test(tail) ? tail : null
}

function parseRelationIdFromOsmId(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw !== 0) return String(Math.trunc(Math.abs(raw)))
    return null
  }
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (text.length === 0) return null
  const asNumber = Number(text)
  if (!Number.isFinite(asNumber)) return null
  if (asNumber !== 0) return String(Math.trunc(Math.abs(asNumber)))
  return null
}

function resolveRelationId(props: Record<string, unknown> | null | undefined): string | null {
  if (!props) return null
  return parseRelationId(props['@id']) ?? parseRelationIdFromOsmId(props.osm_id)
}

export async function runCompare(
  runtimeRoot: string,
  areaFolder: string,
  configRaw: DatasetConfig,
  phaseLogger?: ComparePhaseLogger,
  instrumentation?: CompareInstrumentation,
): Promise<{
  config: BoundaryConfig
  rows: CompareRow[]
  unmatchedOsm: UnmatchedOsmRow[]
  metricsCrs: string
}> {
  const config = loadBoundaryConfig(configRaw, `${areaFolder}`)
  const areaPath = datasetFolderPath(runtimeRoot, areaFolder)
  const officialPath = join(areaPath, config.official.path)
  const osmPath = osmFgbPathFromConfig(runtimeRoot, config.osm)
  if (!existsSync(osmPath)) {
    throw new Error(
      `Configured OSM FlatGeobuf not found:\n  ${osmPath}\n\nRun: bun run osm:extract`,
    )
  }
  const osmMatchProperty = config.osm.matchProperty
  const relationIdCriteria =
    config.osm.matchCriteria?.kind === 'relation_id'
      ? new Set(config.osm.matchCriteria.relationIds)
      : null
  const preset = config.idNormalization.preset
  const metricsCrs = config.metricsCrs

  const tLoadOfficial = Date.now()
  instrumentation?.setInFlightPhase?.('load_official')
  instrumentation?.checkpoint?.('before_load_official', { path: officialPath })
  const officialFc = await loadFeatureCollection(officialPath)
  phaseLogger?.('load_official', Date.now() - tLoadOfficial, {
    featureCount: officialFc.features.length,
  })
  instrumentation?.checkpoint?.('after_load_official', { featureCount: officialFc.features.length })

  const tLoadOsm = Date.now()
  instrumentation?.setInFlightPhase?.('load_osm')
  instrumentation?.checkpoint?.('before_load_osm', { path: osmPath })
  let osmFc = await loadFeatureCollection(osmPath)
  phaseLogger?.('load_osm', Date.now() - tLoadOsm, { featureCount: osmFc.features.length })
  instrumentation?.checkpoint?.('after_load_osm', { featureCount: osmFc.features.length })

  const initialOsmFeatureCount = osmFc.features.length
  let droppedByBbox = 0
  let droppedByScope = 0
  let droppedByAdminLevel = 0
  let droppedByIgnore = 0

  if (config.compare.bboxFilter === 'official_bbox_overlap') {
    const tFilterBbox = Date.now()
    const ob = unionOfficialBbox(officialFc.features)
    if (!ob) {
      throw new Error(
        `${areaFolder}: compare.bboxFilter="official_bbox_overlap" but official features have no geometries to derive a bbox`,
      )
    }
    const buf = config.compare.bboxBufferDegrees ?? 0
    const filtered = filterOsmByOfficialBbox(osmFc.features, ob, buf)
    droppedByBbox = osmFc.features.length - filtered.length
    osmFc = { type: 'FeatureCollection', features: filtered }
    phaseLogger?.('filter_bbox', Date.now() - tFilterBbox, {
      dropped: droppedByBbox,
      remaining: osmFc.features.length,
    })
  }
  if (config.compare.osmScopeFilter === 'centroid_in_official_coverage') {
    const tScopeFilter = Date.now()
    const filtered = filterOsmByOfficialCoverageCentroid(osmFc.features, officialFc.features)
    droppedByScope = osmFc.features.length - filtered.length
    osmFc = { type: 'FeatureCollection', features: filtered }
    phaseLogger?.('filter_scope', Date.now() - tScopeFilter, {
      dropped: droppedByScope,
      remaining: osmFc.features.length,
    })
  }
  if ((config.osm.adminLevels?.length ?? 0) > 0) {
    const tAdminLevelFilter = Date.now()
    const adminLevels = new Set(config.osm.adminLevels)
    const filtered = filterOsmByAdminLevels(osmFc.features, adminLevels)
    droppedByAdminLevel = osmFc.features.length - filtered.length
    osmFc = { type: 'FeatureCollection', features: filtered }
    phaseLogger?.('filter_admin_level', Date.now() - tAdminLevelFilter, {
      dropped: droppedByAdminLevel,
      remaining: osmFc.features.length,
      configuredAdminLevels: adminLevels.size,
    })
  }
  if ((config.osm.ignoreRelationIds?.length ?? 0) > 0) {
    const tIgnoreFilter = Date.now()
    const ignoredRelationIds = new Set(config.osm.ignoreRelationIds)
    const filtered = filterOsmByIgnoredRelationIds(osmFc.features, ignoredRelationIds)
    droppedByIgnore = osmFc.features.length - filtered.length
    osmFc = { type: 'FeatureCollection', features: filtered }
    phaseLogger?.('filter_ignore_relations', Date.now() - tIgnoreFilter, {
      dropped: droppedByIgnore,
      remaining: osmFc.features.length,
      configuredIgnoreRelationIds: ignoredRelationIds.size,
    })
  }
  if (droppedByBbox > 0 || droppedByScope > 0 || droppedByAdminLevel > 0 || droppedByIgnore > 0) {
    console.log(
      `${areaFolder}: OSM scope filtering kept ${osmFc.features.length}/${initialOsmFeatureCount} features (bbox dropped: ${droppedByBbox}, centroid scope dropped: ${droppedByScope}, admin_level dropped: ${droppedByAdminLevel}, ignore dropped: ${droppedByIgnore})`,
    )
  }

  const tUnionOfficial = Date.now()
  instrumentation?.setInFlightPhase?.('union_official')
  instrumentation?.checkpoint?.('before_union_official')
  const officialMap = unionFeaturesByKey(officialFc, (props) => {
    if (config.official.constantMatchKey) {
      return normalizeOfficialValue(config.official.constantMatchKey, preset)
    }
    return officialPropertyToMatchKey(
      props as Record<string, unknown> | null,
      config.official.matchProperty,
      config.official.keyTransposition,
      preset,
    )
  })
  phaseLogger?.('union_official', Date.now() - tUnionOfficial, { keys: officialMap.size })
  instrumentation?.checkpoint?.('after_union_official', { keys: officialMap.size })

  const tUnionOsm = Date.now()
  instrumentation?.setInFlightPhase?.('union_osm')
  instrumentation?.checkpoint?.('before_union_osm')
  const osmMap = unionFeaturesByKey(osmFc, (props) => {
    const p = props as Record<string, unknown>
    if (relationIdCriteria) {
      const relId = resolveRelationId(p)
      if (!relId || !relationIdCriteria.has(relId)) return null
      return normalizeOsmValue('osm_relation_id', relId, preset).canonicalMatchKey
    }
    const v = p?.[osmMatchProperty]
    if (v == null) return null
    return normalizeOsmValue(osmMatchProperty, String(v), preset).canonicalMatchKey
  })
  phaseLogger?.('union_osm', Date.now() - tUnionOsm, { keys: osmMap.size })
  instrumentation?.checkpoint?.('after_union_osm', { keys: osmMap.size })

  const osmNameByKey = new Map<string, string>()
  for (const f of osmFc.features) {
    const props = f.properties as Record<string, unknown>
    let canonicalKey: string | null = null
    if (relationIdCriteria) {
      const relId = resolveRelationId(props)
      if (!relId || !relationIdCriteria.has(relId)) continue
      canonicalKey = normalizeOsmValue('osm_relation_id', relId, preset).canonicalMatchKey
    } else {
      const v = props?.[osmMatchProperty]
      if (v == null) continue
      canonicalKey = normalizeOsmValue(osmMatchProperty, String(v), preset).canonicalMatchKey
    }
    if (canonicalKey == null || canonicalKey.length === 0) continue
    const nm = (f.properties as Record<string, unknown>)?.name
    if (typeof nm === 'string' && nm && !osmNameByKey.has(canonicalKey)) {
      osmNameByKey.set(canonicalKey, nm)
    }
  }

  const officialKeys = Array.from(officialMap.keys()).sort()
  const rows: CompareRow[] = []
  const pendingMetrics: Array<{
    rowIndex: number
    officialProjected: Geometry
    osmProjected: Geometry
  }> = []

  const tProject = Date.now()
  instrumentation?.setInFlightPhase?.('project')
  instrumentation?.checkpoint?.('before_project_loop', { totalRows: officialKeys.length })
  const projectProgressInterval = 1000
  for (const key of officialKeys) {
    const o = officialMap.get(key)
    const s = osmMap.get(key)
    const officialGeom = o?.geometry ?? null
    const osmGeom = s?.geometry ?? null
    const nameLabel = osmNameByKey.get(key) ?? key

    const category: CompareRow['category'] = officialGeom && osmGeom ? 'matched' : 'official_only'

    const osmRelationId = osmGeom
      ? pickOsmRelationId(s?.featureIds ?? [], s?.properties ?? null)
      : ''

    let metrics: MetricResult | null = null
    if (category === 'matched' && officialGeom && osmGeom) {
      const op = projectGeometry(officialGeom, metricsCrs)
      const sp = projectGeometry(osmGeom, metricsCrs)
      pendingMetrics.push({
        rowIndex: rows.length,
        officialProjected: op,
        osmProjected: sp,
      })
    }

    rows.push({
      canonicalMatchKey: key,
      nameLabel,
      category,
      osmRelationId,
      metrics,
      officialGeometryWgs84: officialGeom,
      osmGeometryWgs84: osmGeom,
      officialProperties: o?.properties ?? null,
      osmProperties: s?.properties ?? null,
    })
    if (rows.length % projectProgressInterval === 0 || rows.length === officialKeys.length) {
      instrumentation?.progress?.('project_rows', rows.length, officialKeys.length, {
        elapsedMs: Date.now() - tProject,
        pendingMetrics: pendingMetrics.length,
      })
    }
  }
  phaseLogger?.('project', Date.now() - tProject, {
    rows: rows.length,
    pendingMetrics: pendingMetrics.length,
  })
  instrumentation?.checkpoint?.('after_project_loop', {
    rows: rows.length,
    pendingMetrics: pendingMetrics.length,
  })

  if (pendingMetrics.length > 0) {
    const tMetrics = Date.now()
    instrumentation?.setInFlightPhase?.('metrics')
    instrumentation?.checkpoint?.('before_metrics_rust', { pendingMetrics: pendingMetrics.length })
    const rustMetrics = calculateMetricsBatchWithRust(
      pendingMetrics.map((entry) => ({
        officialProjected: entry.officialProjected,
        osmProjected: entry.osmProjected,
      })),
    )
    for (let i = 0; i < pendingMetrics.length; i++) {
      const row = rows[pendingMetrics[i]!.rowIndex]
      if (row) row.metrics = rustMetrics[i] ?? null
    }
    phaseLogger?.('metrics', Date.now() - tMetrics, {
      calculated: pendingMetrics.length,
    })
    instrumentation?.checkpoint?.('after_metrics_rust', {
      calculated: pendingMetrics.length,
      elapsedMs: Date.now() - tMetrics,
    })
  }
  instrumentation?.setInFlightPhase?.(null)

  const officialKeySet = new Set(officialMap.keys())
  const unmatchedOsm: UnmatchedOsmRow[] = []
  for (const key of Array.from(osmMap.keys()).sort()) {
    if (officialKeySet.has(key)) continue
    const s = osmMap.get(key)
    if (!s) continue
    const props = s.properties as Record<string, unknown> | null
    const nameLabel =
      typeof props?.name === 'string' && props.name.trim().length > 0
        ? props.name.trim()
        : (osmNameByKey.get(key) ?? key)
    unmatchedOsm.push({
      canonicalMatchKey: key,
      nameLabel,
      osmRelationId: pickOsmRelationId(s.featureIds, props),
      adminLevel: readAdminLevel(props),
      osmGeometryWgs84: s.geometry ?? null,
    })
  }

  return { config, rows, unmatchedOsm, metricsCrs }
}
