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
  /** If true, drop OSM features whose bbox does not overlap an expanded official union bbox. */
  applyBboxFilter?: boolean
  /** Pad official bbox in degrees (default 0.05 ≈ few km at mid-latitudes). */
  bboxBufferDegrees?: number
}

export type OsmConfig = {
  /** Property on OSM features used as matching key (for example `de:regionalschluessel`, `postal_code`). */
  matchProperty: string
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
    keyTransposition?: OfficialKeyTransposition
  }
  osm: OsmConfig
  compare?: CompareConfig
  idNormalization: { preset: IdNormalizationPreset }
  metricsCrs: string
}

function parseCompareConfig(areaLabel: string, raw: unknown): CompareConfig | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${areaLabel}: compare must be an object`)
  }
  const o = raw as Record<string, unknown>
  const out: CompareConfig = {}
  if (o.applyBboxFilter === true) out.applyBboxFilter = true
  if (o.applyBboxFilter === false) out.applyBboxFilter = false
  if (o.applyBboxFilter !== undefined && typeof o.applyBboxFilter !== 'boolean') {
    throw new Error(`${areaLabel}: compare.applyBboxFilter must be a boolean`)
  }
  if (o.bboxBufferDegrees !== undefined) {
    if (typeof o.bboxBufferDegrees !== 'number' || !Number.isFinite(o.bboxBufferDegrees)) {
      throw new Error(`${areaLabel}: compare.bboxBufferDegrees must be a finite number`)
    }
    if (o.bboxBufferDegrees < 0) {
      throw new Error(`${areaLabel}: compare.bboxBufferDegrees must be >= 0`)
    }
    out.bboxBufferDegrees = o.bboxBufferDegrees
  }
  return Object.keys(out).length > 0 ? out : undefined
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

  if (pathRaw) return { matchProperty, path: pathRaw }
  return { matchProperty, sharedFgbBasename: sharedRaw }
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
      ...(keyTransposition ? { keyTransposition } : {}),
    },
    osm,
    ...(compare ? { compare } : {}),
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
