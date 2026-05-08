import { existsSync } from 'node:fs'
import { join } from 'node:path'
import * as turf from '@turf/turf'
import type { BBox, Feature, Geometry, MultiPolygon, Point, Polygon } from 'geojson'
import type { DatasetConfig } from '../../shared/datasetConfig.ts'
import { datasetFolderPath } from '../../shared/datasetPaths.ts'
import type { BoundaryConfig, IdNormalizationPreset } from './config.ts'
import { loadBoundaryConfig, osmFgbPathFromConfig } from './config.ts'
import { unionFeaturesByKey } from './geoMerge.ts'
import { loadFeatureCollection } from './loadFeatureCollection.ts'
import {
  type CandidateMatch,
  loadCandidatePoints,
  matchCandidatesForOfficialOnly,
  type OfficialOnlyInput,
  selectEligibleCandidates,
} from './matchCandidates.ts'
import { type MetricResult } from './metrics.ts'
import {
  classifyIssueIndicator,
  computeBaselineAnomalies,
  withRobustBoundaryMetrics,
} from './metrics/issueIndicator.ts'
import { isPoly } from './metrics/sharedGeom.ts'
import { normalizeOfficialValue, normalizeOsmValue } from './normalizeGermanKey.ts'
import { officialPropertyToMatchKey } from './officialKeyTransposition.ts'
import { projectGeometry } from './projectGeometry.ts'
import { calculateMetricsBatchWithRust } from './rustGeomSidecar.ts'

/**
 * Per-row visibility into how the OSM side was joined for AGS-mode datasets.
 * `matchPath` is `ags_direct` when OSM carried `de:amtlicher_gemeindeschluessel`,
 * `ags_from_rs_fallback` when AGS was derived from canonical `de:regionalschluessel`
 * (first5 + last3) because AGS was missing, and `none` when neither was usable.
 *
 * Only emitted for AGS-mode datasets (osmProfile=admin_ags); all `null` otherwise.
 */
export type OsmMatchDiagnostics = {
  matchPath: 'ags_direct' | 'ags_from_rs_fallback' | 'none'
  agsRaw: string | null
  rsRaw: string | null
  agsFromRs: string | null
  missingRecommendedTags: string[]
}

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
  /** Per-row OSM match diagnostics for AGS-mode datasets (null otherwise). */
  osmMatchDiagnostics: OsmMatchDiagnostics | null
  /**
   * Candidate OSM features whose representative point falls inside the shrunk official
   * polygon for this row. Only populated for `category=='official_only'` rows; an empty
   * array means the candidate phase ran and produced no matches, while `undefined`
   * means the phase was skipped (e.g. candidate FGB missing).
   */
  candidates?: CandidateMatch[]
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

const OSM_AGS_TAG = 'de:amtlicher_gemeindeschluessel'
const OSM_RS_TAG = 'de:regionalschluessel'

function readTrimmedTag(props: Record<string, unknown> | null | undefined, tag: string): string {
  if (!props) return ''
  const v = props[tag]
  if (v == null) return ''
  return String(v).trim()
}

/** Derive 8-digit AGS from a canonical 12-digit ARS (LLRKK + GGG); returns null if RS lacks 12 digits. */
function deriveAgsFromRs(rsRaw: string): string | null {
  const digits = rsRaw.replace(/\D/g, '')
  if (digits.length < 12) return null
  return `${digits.slice(0, 5)}${digits.slice(9, 12)}`
}

type OsmKeyResult = {
  canonicalKey: string | null
  diagnostics: OsmMatchDiagnostics
}

/**
 * AGS-first OSM keying for `osmProfile=admin_ags`:
 *   1. canonical `de:amtlicher_gemeindeschluessel` → `ags_direct`
 *   2. AGS derived from canonical `de:regionalschluessel` (first5+last3) → `ags_from_rs_fallback`
 *
 * Lifecycle-prefixed RS variants (`abandoned:de:regionalschluessel` etc.) are intentionally NOT
 * consulted — the compare key is the live tag only.
 */
function deriveOsmKeyForAgsMode(
  props: Record<string, unknown> | null | undefined,
  preset: IdNormalizationPreset,
): OsmKeyResult {
  const agsRaw = readTrimmedTag(props, OSM_AGS_TAG)
  const rsRaw = readTrimmedTag(props, OSM_RS_TAG)
  const agsFromRs = rsRaw ? deriveAgsFromRs(rsRaw) : null

  if (agsRaw) {
    const canonical = normalizeOsmValue(OSM_AGS_TAG, agsRaw, preset).canonicalMatchKey || null
    const missing: string[] = []
    if (!rsRaw) missing.push(OSM_RS_TAG)
    return {
      canonicalKey: canonical,
      diagnostics: {
        matchPath: canonical ? 'ags_direct' : 'none',
        agsRaw: agsRaw || null,
        rsRaw: rsRaw || null,
        agsFromRs,
        missingRecommendedTags: missing,
      },
    }
  }
  if (agsFromRs) {
    const canonical = normalizeOsmValue(OSM_AGS_TAG, agsFromRs, preset).canonicalMatchKey || null
    return {
      canonicalKey: canonical,
      diagnostics: {
        matchPath: canonical ? 'ags_from_rs_fallback' : 'none',
        agsRaw: null,
        rsRaw: rsRaw || null,
        agsFromRs,
        missingRecommendedTags: [OSM_AGS_TAG],
      },
    }
  }
  const missing: string[] = []
  if (!agsRaw) missing.push(OSM_AGS_TAG)
  if (!rsRaw) missing.push(OSM_RS_TAG)
  return {
    canonicalKey: null,
    diagnostics: {
      matchPath: 'none',
      agsRaw: null,
      rsRaw: rsRaw || null,
      agsFromRs: null,
      missingRecommendedTags: missing,
    },
  }
}

export async function runCompare(
  runtimeRoot: string,
  areaFolder: string,
  configRaw: DatasetConfig,
  phaseLogger?: ComparePhaseLogger,
  instrumentation?: CompareInstrumentation,
  options?: {
    previousMetricsByKey?: Map<string, MetricResult>
    skipIssueIndicator?: boolean
  },
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
  const isAgsMode = osmMatchProperty === OSM_AGS_TAG
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
  const loadOfficialMs = Date.now() - tLoadOfficial
  phaseLogger?.('load_official', loadOfficialMs, {
    featureCount: officialFc.features.length,
  })
  // Also surface to stdout: heavy datasets like de-gemeinden spend many seconds in load/union
  // phases; without stdout output the GitHub Actions runner has nothing but heartbeats to show.
  console.log(
    `[compare:${areaFolder}] load_official done features=${officialFc.features.length} elapsedMs=${loadOfficialMs}`,
  )
  instrumentation?.checkpoint?.('after_load_official', { featureCount: officialFc.features.length })

  const tLoadOsm = Date.now()
  instrumentation?.setInFlightPhase?.('load_osm')
  instrumentation?.checkpoint?.('before_load_osm', { path: osmPath })
  let osmFc = await loadFeatureCollection(osmPath)
  const loadOsmMs = Date.now() - tLoadOsm
  phaseLogger?.('load_osm', loadOsmMs, { featureCount: osmFc.features.length })
  console.log(
    `[compare:${areaFolder}] load_osm done features=${osmFc.features.length} elapsedMs=${loadOsmMs}`,
  )
  instrumentation?.checkpoint?.('after_load_osm', { featureCount: osmFc.features.length })

  const initialOsmFeatureCount = osmFc.features.length
  let droppedByBbox = 0
  let droppedByScope = 0
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
  if (droppedByBbox > 0 || droppedByScope > 0 || droppedByIgnore > 0) {
    console.log(
      `${areaFolder}: OSM scope filtering kept ${osmFc.features.length}/${initialOsmFeatureCount} features (bbox dropped: ${droppedByBbox}, centroid scope dropped: ${droppedByScope}, ignore dropped: ${droppedByIgnore})`,
    )
  }

  console.log(
    `[compare:${areaFolder}] starting union_official featureCount=${officialFc.features.length}`,
  )
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
  const unionOfficialMs = Date.now() - tUnionOfficial
  phaseLogger?.('union_official', unionOfficialMs, { keys: officialMap.size })
  console.log(
    `[compare:${areaFolder}] union_official done keys=${officialMap.size} elapsedMs=${unionOfficialMs}`,
  )
  instrumentation?.checkpoint?.('after_union_official', { keys: officialMap.size })

  console.log(`[compare:${areaFolder}] starting union_osm featureCount=${osmFc.features.length}`)
  const tUnionOsm = Date.now()
  instrumentation?.setInFlightPhase?.('union_osm')
  instrumentation?.checkpoint?.('before_union_osm')
  /** First-writer-wins diagnostics per canonical OSM key (only populated for AGS-mode datasets). */
  const osmDiagnosticsByKey = new Map<string, OsmMatchDiagnostics>()
  const osmMap = unionFeaturesByKey(osmFc, (props) => {
    const p = props as Record<string, unknown>
    if (relationIdCriteria) {
      const relId = resolveRelationId(p)
      if (!relId || !relationIdCriteria.has(relId)) return null
      return normalizeOsmValue('osm_relation_id', relId, preset).canonicalMatchKey
    }
    if (isAgsMode) {
      const result = deriveOsmKeyForAgsMode(p, preset)
      if (result.canonicalKey == null || result.canonicalKey.length === 0) return null
      if (!osmDiagnosticsByKey.has(result.canonicalKey)) {
        osmDiagnosticsByKey.set(result.canonicalKey, result.diagnostics)
      }
      return result.canonicalKey
    }
    const v = p?.[osmMatchProperty]
    if (v == null) return null
    return normalizeOsmValue(osmMatchProperty, String(v), preset).canonicalMatchKey
  })
  const unionOsmMs = Date.now() - tUnionOsm
  phaseLogger?.('union_osm', unionOsmMs, { keys: osmMap.size })
  console.log(`[compare:${areaFolder}] union_osm done keys=${osmMap.size} elapsedMs=${unionOsmMs}`)
  instrumentation?.checkpoint?.('after_union_osm', { keys: osmMap.size })

  const osmNameByKey = new Map<string, string>()
  for (const f of osmFc.features) {
    const props = f.properties as Record<string, unknown>
    let canonicalKey: string | null = null
    if (relationIdCriteria) {
      const relId = resolveRelationId(props)
      if (!relId || !relationIdCriteria.has(relId)) continue
      canonicalKey = normalizeOsmValue('osm_relation_id', relId, preset).canonicalMatchKey
    } else if (isAgsMode) {
      canonicalKey = deriveOsmKeyForAgsMode(props, preset).canonicalKey
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

    let osmMatchDiagnostics: OsmMatchDiagnostics | null = null
    if (isAgsMode) {
      if (osmGeom) {
        osmMatchDiagnostics = osmDiagnosticsByKey.get(key) ?? {
          matchPath: 'none',
          agsRaw: null,
          rsRaw: null,
          agsFromRs: null,
          missingRecommendedTags: [OSM_AGS_TAG, OSM_RS_TAG],
        }
      } else {
        osmMatchDiagnostics = {
          matchPath: 'none',
          agsRaw: null,
          rsRaw: null,
          agsFromRs: null,
          missingRecommendedTags: [],
        }
      }
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
      osmMatchDiagnostics,
    })
    if (rows.length % projectProgressInterval === 0 || rows.length === officialKeys.length) {
      instrumentation?.progress?.('project_rows', rows.length, officialKeys.length, {
        elapsedMs: Date.now() - tProject,
        pendingMetrics: pendingMetrics.length,
      })
    }
  }
  const projectMs = Date.now() - tProject
  phaseLogger?.('project', projectMs, {
    rows: rows.length,
    pendingMetrics: pendingMetrics.length,
  })
  console.log(
    `[compare:${areaFolder}] project done rows=${rows.length} pendingMetrics=${pendingMetrics.length} elapsedMs=${projectMs}`,
  )
  instrumentation?.checkpoint?.('after_project_loop', {
    rows: rows.length,
    pendingMetrics: pendingMetrics.length,
  })

  if (pendingMetrics.length > 0) {
    console.log(
      `[compare:${areaFolder}] starting metrics_rust pendingMetrics=${pendingMetrics.length}`,
    )
    const tMetrics = Date.now()
    instrumentation?.setInFlightPhase?.('metrics')
    instrumentation?.checkpoint?.('before_metrics_rust', { pendingMetrics: pendingMetrics.length })
    const rustMetrics = calculateMetricsBatchWithRust(
      pendingMetrics.map((entry) => ({
        officialProjected: entry.officialProjected,
        osmProjected: entry.osmProjected,
      })),
    )
    const baselineRows: Array<{ key: string; current: MetricResult; previous: MetricResult }> = []
    const skipIssueIndicator = options?.skipIssueIndicator === true
    for (let i = 0; i < pendingMetrics.length; i++) {
      const pending = pendingMetrics[i]
      if (!pending) continue
      const row = rows[pending.rowIndex]
      const metric = rustMetrics[i] ?? null
      if (!row) continue
      if (!metric) {
        row.metrics = null
        continue
      }
      if (skipIssueIndicator) {
        row.metrics = metric
        continue
      }
      const withRobust =
        isPoly(pending.officialProjected) && isPoly(pending.osmProjected)
          ? withRobustBoundaryMetrics(metric, pending.officialProjected, pending.osmProjected)
          : metric
      row.metrics = withRobust
      const previous = options?.previousMetricsByKey?.get(row.canonicalMatchKey)
      if (previous) baselineRows.push({ key: row.canonicalMatchKey, current: withRobust, previous })
    }
    if (!skipIssueIndicator) {
      const baselineByKey = computeBaselineAnomalies(baselineRows)
      for (const row of rows) {
        if (!row.metrics) continue
        const baselineReasons = baselineByKey.get(row.canonicalMatchKey) ?? []
        row.metrics.issueIndicator = classifyIssueIndicator(row.metrics, baselineReasons)
      }
    }
    const metricsMs = Date.now() - tMetrics
    phaseLogger?.('metrics', metricsMs, {
      calculated: pendingMetrics.length,
    })
    console.log(
      `[compare:${areaFolder}] metrics_rust done calculated=${pendingMetrics.length} elapsedMs=${metricsMs}`,
    )
    instrumentation?.checkpoint?.('after_metrics_rust', {
      calculated: pendingMetrics.length,
      elapsedMs: metricsMs,
    })
  }
  instrumentation?.setInFlightPhase?.(null)

  const officialKeySet = new Set(officialMap.keys())
  const adminLevelAllowList =
    config.osm.adminLevels && config.osm.adminLevels.length > 0
      ? new Set(config.osm.adminLevels)
      : null
  const unmatchedOsm: UnmatchedOsmRow[] = []
  let droppedUnmatchedByAdminLevel = 0
  const tFilterUnmatchedAdminLevel = Date.now()
  for (const key of Array.from(osmMap.keys()).sort()) {
    if (officialKeySet.has(key)) continue
    const s = osmMap.get(key)
    if (!s) continue
    const props = s.properties as Record<string, unknown> | null
    const adminLevel = readAdminLevel(props)
    // Let Kreisfreie Städte / Stadtstaaten match by key even when their OSM boundary lives
    // at admin_level=6/4, but keep the OSM-only report scoped to the configured level.
    if (adminLevelAllowList && (adminLevel == null || !adminLevelAllowList.has(adminLevel))) {
      droppedUnmatchedByAdminLevel++
      continue
    }
    const nameLabel =
      typeof props?.name === 'string' && props.name.trim().length > 0
        ? props.name.trim()
        : (osmNameByKey.get(key) ?? key)
    unmatchedOsm.push({
      canonicalMatchKey: key,
      nameLabel,
      osmRelationId: pickOsmRelationId(s.featureIds, props),
      adminLevel,
      osmGeometryWgs84: s.geometry ?? null,
    })
  }
  if (adminLevelAllowList) {
    phaseLogger?.('filter_unmatched_admin_level', Date.now() - tFilterUnmatchedAdminLevel, {
      dropped: droppedUnmatchedByAdminLevel,
      remaining: unmatchedOsm.length,
      configuredAdminLevels: adminLevelAllowList.size,
    })
    if (droppedUnmatchedByAdminLevel > 0) {
      console.log(
        `[compare:${areaFolder}] unmatched_osm admin_level filter dropped=${droppedUnmatchedByAdminLevel} remaining=${unmatchedOsm.length}`,
      )
    }
  }

  // Candidate matching is strictly additive: if the candidate FGB is missing or no
  // `official_only` rows exist, we silently skip and leave `row.candidates` undefined so
  // the strong-match pipeline keeps the same observable behaviour as before.
  const officialOnlyRowIndexes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.category === 'official_only')
  if (officialOnlyRowIndexes.length > 0) {
    const tCandidates = Date.now()
    instrumentation?.setInFlightPhase?.('match_candidates')
    instrumentation?.checkpoint?.('before_match_candidates', {
      officialOnly: officialOnlyRowIndexes.length,
    })
    const { features: candidateFeaturesRaw, sourcePath } = await loadCandidatePoints(
      runtimeRoot,
      config,
    )
    if (candidateFeaturesRaw.length === 0) {
      console.log(
        `[compare:${areaFolder}] match_candidates skipped: candidate FGB missing or empty (${sourcePath ?? 'no path'})`,
      )
      phaseLogger?.('match_candidates', Date.now() - tCandidates, {
        skipped: true,
        reason: 'candidate_fgb_missing',
      })
    } else {
      const adminLevelAllowList =
        config.osm.adminLevels && config.osm.adminLevels.length > 0
          ? new Set(config.osm.adminLevels)
          : undefined
      const ignoreRelationIds =
        config.osm.ignoreRelationIds && config.osm.ignoreRelationIds.length > 0
          ? new Set(config.osm.ignoreRelationIds)
          : undefined
      const officialBbox =
        config.compare.bboxFilter === 'official_bbox_overlap'
          ? unionOfficialBbox(officialFc.features)
          : null
      const bboxFilter = officialBbox
        ? expandBbox(officialBbox, config.compare.bboxBufferDegrees ?? 0)
        : undefined
      const eligible = selectEligibleCandidates(candidateFeaturesRaw, {
        adminLevelAllowList,
        ignoreRelationIds,
        ...(bboxFilter ? { bboxFilter } : {}),
      })
      const officialOnlyInputs: OfficialOnlyInput[] = officialOnlyRowIndexes.map(({ row }) => ({
        canonicalMatchKey: row.canonicalMatchKey,
        officialGeometryWgs84:
          row.officialGeometryWgs84 &&
          (row.officialGeometryWgs84.type === 'Polygon' ||
            row.officialGeometryWgs84.type === 'MultiPolygon')
            ? (row.officialGeometryWgs84 as Polygon | MultiPolygon)
            : null,
      }))
      const matches = matchCandidatesForOfficialOnly({
        rows: officialOnlyInputs,
        officialKeySet,
        candidatePoints: eligible,
        options: {
          shrinkFactor: config.compare.candidateShrinkFactor,
          ...(adminLevelAllowList ? { adminLevelAllowList } : {}),
          ...(ignoreRelationIds ? { ignoreRelationIds } : {}),
          ...(bboxFilter ? { bboxFilter } : {}),
          idNormalizationPreset: preset,
          osmProfileId: config.osm.profileId as Parameters<
            typeof matchCandidatesForOfficialOnly
          >[0]['options']['osmProfileId'],
          osmMatchProperty,
        },
      })
      let totalCandidates = 0
      for (const { row, index } of officialOnlyRowIndexes) {
        const candidatesForRow = matches.get(row.canonicalMatchKey) ?? []
        totalCandidates += candidatesForRow.length
        rows[index]!.candidates = candidatesForRow
      }
      const candidatesMs = Date.now() - tCandidates
      phaseLogger?.('match_candidates', candidatesMs, {
        officialOnly: officialOnlyRowIndexes.length,
        eligibleCandidates: eligible.length,
        totalCandidates,
      })
      console.log(
        `[compare:${areaFolder}] match_candidates done officialOnly=${officialOnlyRowIndexes.length} eligible=${eligible.length} totalCandidates=${totalCandidates} elapsedMs=${candidatesMs}`,
      )
      instrumentation?.checkpoint?.('after_match_candidates', {
        eligibleCandidates: eligible.length,
        totalCandidates,
        elapsedMs: candidatesMs,
      })
    }
    instrumentation?.setInFlightPhase?.(null)
  }

  return { config, rows, unmatchedOsm, metricsCrs }
}
