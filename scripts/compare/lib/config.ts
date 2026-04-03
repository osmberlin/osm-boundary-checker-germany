import { join } from 'node:path'
import {
  GERMANY_OSM_CACHE_DIR,
  GERMANY_OSM_SHARED_FGB_BASENAME,
} from '../../shared/germanyOsmPbf.ts'
import {
  type OfficialKeyTransposition,
  parseOfficialKeyTransposition,
} from './officialKeyTransposition.ts'

export type IdNormalizationPreset = 'berlin-bezirk-ags' | 'amtlicher-8' | 'regional-12'

/** OSM tagging: fixed project-wide (all areas use the same column in GDAL output). */
export const OSM_MATCH_PROPERTY = 'de:regionalschluessel'

/** Optional compare tuning (bbox prefilter, etc.). */
export type CompareConfig = {
  /** If true, drop OSM features whose bbox does not overlap an expanded official union bbox. */
  applyBboxFilter?: boolean
  /** Pad official bbox in degrees (default 0.05 ≈ few km at mid-latitudes). */
  bboxBufferDegrees?: number
}

/** Paths under the area folder for official input only; OSM is always the shared cache FGB. */
export type BoundaryConfig = {
  official: {
    path: string
    matchProperty: string
    keyTransposition?: OfficialKeyTransposition
  }
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

export function loadBoundaryConfig(json: unknown, areaLabel = 'area'): BoundaryConfig {
  const c = json as BoundaryConfig
  if (!c?.official?.path || !c?.official?.matchProperty) {
    throw new Error('Invalid area config: missing official.path or official.matchProperty')
  }
  if (!c?.idNormalization?.preset || !c?.metricsCrs) {
    throw new Error('Invalid area config: missing idNormalization.preset or metricsCrs')
  }
  const matchProperty = String(c.official.matchProperty).trim()
  if (!matchProperty) {
    throw new Error('Invalid area config: official.matchProperty is empty')
  }

  const officialRaw = c.official as Record<string, unknown>
  const keyTransposition = parseOfficialKeyTransposition(
    areaLabel,
    matchProperty,
    officialRaw.keyTransposition,
  )

  const compare = parseCompareConfig(areaLabel, (c as Record<string, unknown>).compare)

  return {
    official: {
      path: String(c.official.path).trim(),
      matchProperty,
      ...(keyTransposition ? { keyTransposition } : {}),
    },
    ...(compare ? { compare } : {}),
    idNormalization: c.idNormalization,
    metricsCrs: String(c.metricsCrs).trim(),
  }
}

/** Runtime-root path to the shared OSM FlatGeobuf (`bun run osm:extract`). */
export function sharedGermanyOsmFgbPath(runtimeRoot: string): string {
  return join(runtimeRoot, GERMANY_OSM_CACHE_DIR, GERMANY_OSM_SHARED_FGB_BASENAME)
}
