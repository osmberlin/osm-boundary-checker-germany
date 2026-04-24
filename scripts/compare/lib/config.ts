import { isAbsolute, join } from 'node:path'
import {
  GERMANY_OSM_CACHE_DIR,
  GERMANY_OSM_SHARED_FGB_BASENAME,
} from '../../shared/germanyOsmPbf.ts'
import {
  type OfficialKeyTransposition,
  parseOfficialKeyTransposition,
} from './officialKeyTransposition.ts'

export type IdNormalizationPreset =
  | 'berlin-bezirk-ags'
  | 'amtlicher-8'
  | 'regional-12'
  | 'brandenburg-gemeinden-8'
  | 'plz-5'

export const DEFAULT_OSM_MATCH_PROPERTY = 'de:regionalschluessel'

/** Optional compare tuning (bbox prefilter, etc.). */
export type CompareConfig = {
  /** OSM bbox prefilter strategy before key matching. */
  bboxFilter: 'none' | 'official_bbox_overlap'
  /** Pad official bbox in degrees (required when bboxFilter=official_bbox_overlap). */
  bboxBufferDegrees?: number
  /** Geometric scope filter for OSM features after bbox prefilter. */
  osmScopeFilter: 'none' | 'centroid_in_official_coverage'
}

export type OsmConfig = {
  /** Property on OSM features used as matching key (for example `de:regionalschluessel`, `postal_code`). */
  matchProperty: string
  /**
   * Optional alternate matching criteria.
   * - `property`: match on a property value (default behavior).
   * - `relation_id`: match only selected relation IDs using `@id` (for example `relation/51477`).
   */
  matchCriteria?: { kind: 'property' } | { kind: 'relation_id'; relationIds: string[] }
  /**
   * Optional runtime-root relative or absolute path to the OSM FlatGeobuf.
   * If omitted, sharedFgbBasename under `.cache/osm` is used.
   */
  path?: string
  /** Optional basename under `.cache/osm` when `path` is not provided. */
  sharedFgbBasename?: string
}

/** Paths under the area folder for official input; OSM path/key are configurable. */
export type BoundaryConfig = {
  official: {
    path: string
    matchProperty: string
    /** Optional fixed key for all official rows in this dataset (normalized with preset). */
    constantMatchKey?: string
    keyTransposition?: OfficialKeyTransposition
  }
  osm: OsmConfig
  compare: CompareConfig
  idNormalization: { preset: IdNormalizationPreset }
  metricsCrs: string
}

function parseCompareConfig(areaLabel: string, raw: unknown): CompareConfig {
  if (raw === undefined || raw === null) {
    throw new Error(`${areaLabel}: compare must be configured explicitly`)
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${areaLabel}: compare must be an object`)
  }
  const o = raw as Record<string, unknown>
  if (typeof o.bboxFilter !== 'string') {
    throw new Error(`${areaLabel}: compare.bboxFilter must be "none" or "official_bbox_overlap"`)
  }
  const bboxFilter = o.bboxFilter.trim()
  if (bboxFilter !== 'none' && bboxFilter !== 'official_bbox_overlap') {
    throw new Error(`${areaLabel}: compare.bboxFilter must be "none" or "official_bbox_overlap"`)
  }

  if (typeof o.osmScopeFilter !== 'string') {
    throw new Error(
      `${areaLabel}: compare.osmScopeFilter must be "none" or "centroid_in_official_coverage"`,
    )
  }
  const scopeFilter = o.osmScopeFilter.trim()
  if (scopeFilter !== 'none' && scopeFilter !== 'centroid_in_official_coverage') {
    throw new Error(
      `${areaLabel}: compare.osmScopeFilter must be "none" or "centroid_in_official_coverage"`,
    )
  }

  let bboxBufferDegrees: number | undefined
  if (bboxFilter === 'official_bbox_overlap') {
    if (typeof o.bboxBufferDegrees !== 'number' || !Number.isFinite(o.bboxBufferDegrees)) {
      throw new Error(
        `${areaLabel}: compare.bboxBufferDegrees must be a finite number when compare.bboxFilter="official_bbox_overlap"`,
      )
    }
    if (o.bboxBufferDegrees < 0) {
      throw new Error(`${areaLabel}: compare.bboxBufferDegrees must be >= 0`)
    }
    bboxBufferDegrees = o.bboxBufferDegrees
  } else if (o.bboxBufferDegrees !== undefined) {
    throw new Error(
      `${areaLabel}: compare.bboxBufferDegrees is only valid when compare.bboxFilter="official_bbox_overlap"`,
    )
  }

  return {
    bboxFilter,
    ...(bboxBufferDegrees !== undefined ? { bboxBufferDegrees } : {}),
    osmScopeFilter: scopeFilter,
  }
}

function parseOsmConfig(areaLabel: string, raw: unknown): OsmConfig {
  if (raw === undefined || raw === null) {
    return {
      matchProperty: DEFAULT_OSM_MATCH_PROPERTY,
      sharedFgbBasename: GERMANY_OSM_SHARED_FGB_BASENAME,
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${areaLabel}: osm must be an object`)
  }
  const o = raw as Record<string, unknown>
  const matchPropertyRaw = typeof o.matchProperty === 'string' ? o.matchProperty.trim() : ''
  const matchProperty = matchPropertyRaw || DEFAULT_OSM_MATCH_PROPERTY

  const pathRaw = typeof o.path === 'string' ? o.path.trim() : ''
  const sharedRaw =
    typeof o.sharedFgbBasename === 'string'
      ? o.sharedFgbBasename.trim()
      : GERMANY_OSM_SHARED_FGB_BASENAME

  if (!matchProperty) {
    throw new Error(`${areaLabel}: osm.matchProperty is empty`)
  }
  if (pathRaw && sharedRaw && sharedRaw !== GERMANY_OSM_SHARED_FGB_BASENAME) {
    throw new Error(`${areaLabel}: set only one of osm.path or osm.sharedFgbBasename`)
  }
  if (!pathRaw && !sharedRaw) {
    throw new Error(`${areaLabel}: osm.path or osm.sharedFgbBasename must be provided`)
  }

  const matchCriteriaRaw = o.matchCriteria
  let matchCriteria: OsmConfig['matchCriteria'] | undefined
  if (matchCriteriaRaw !== undefined) {
    if (
      typeof matchCriteriaRaw !== 'object' ||
      matchCriteriaRaw === null ||
      Array.isArray(matchCriteriaRaw)
    ) {
      throw new Error(`${areaLabel}: osm.matchCriteria must be an object`)
    }
    const m = matchCriteriaRaw as Record<string, unknown>
    const kind = typeof m.kind === 'string' ? m.kind.trim() : ''
    if (kind === '' || kind === 'property') {
      matchCriteria = { kind: 'property' }
    } else if (kind === 'relation_id') {
      if (!Array.isArray(m.relationIds) || m.relationIds.length === 0) {
        throw new Error(`${areaLabel}: osm.matchCriteria.relationIds must be a non-empty array`)
      }
      const relationIds = m.relationIds.map((v) => String(v).trim()).filter((v) => v.length > 0)
      if (relationIds.length === 0) {
        throw new Error(`${areaLabel}: osm.matchCriteria.relationIds must contain non-empty values`)
      }
      matchCriteria = { kind: 'relation_id', relationIds }
    } else {
      throw new Error(`${areaLabel}: osm.matchCriteria.kind must be "property" or "relation_id"`)
    }
  }

  if (pathRaw) return { matchProperty, ...(matchCriteria ? { matchCriteria } : {}), path: pathRaw }
  return {
    matchProperty,
    ...(matchCriteria ? { matchCriteria } : {}),
    sharedFgbBasename: sharedRaw,
  }
}

export function loadBoundaryConfig(json: unknown, areaLabel = 'area'): BoundaryConfig {
  const c = json as Record<string, unknown>
  const official = c.official as Record<string, unknown> | undefined
  if (!official?.path || !official?.matchProperty) {
    throw new Error('Invalid area config: missing official.path or official.matchProperty')
  }
  const idNormalization = c.idNormalization as Record<string, unknown> | undefined
  if (!idNormalization?.preset || !c?.metricsCrs) {
    throw new Error('Invalid area config: missing idNormalization.preset or metricsCrs')
  }
  const matchProperty = String(official.matchProperty).trim()
  if (!matchProperty) {
    throw new Error('Invalid area config: official.matchProperty is empty')
  }

  const keyTransposition = parseOfficialKeyTransposition(
    areaLabel,
    matchProperty,
    official.keyTransposition,
  )

  const compare = parseCompareConfig(areaLabel, c.compare)
  const osm = parseOsmConfig(areaLabel, c.osm)

  return {
    official: {
      path: String(official.path).trim(),
      matchProperty,
      ...(typeof official.constantMatchKey === 'string' && official.constantMatchKey.trim() !== ''
        ? { constantMatchKey: official.constantMatchKey.trim() }
        : {}),
      ...(keyTransposition ? { keyTransposition } : {}),
    },
    osm,
    compare,
    idNormalization: { preset: String(idNormalization.preset).trim() as IdNormalizationPreset },
    metricsCrs: String(c.metricsCrs).trim(),
  }
}

/** Runtime-root path for configured OSM FlatGeobuf. */
export function osmFgbPathFromConfig(runtimeRoot: string, osm: OsmConfig): string {
  if (osm.path) {
    return isAbsolute(osm.path) ? osm.path : join(runtimeRoot, osm.path)
  }
  return join(
    runtimeRoot,
    GERMANY_OSM_CACHE_DIR,
    osm.sharedFgbBasename ?? GERMANY_OSM_SHARED_FGB_BASENAME,
  )
}
