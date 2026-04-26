import { join } from 'node:path'
import type { DatasetConfig } from '../../shared/datasetConfig.ts'
import { GERMANY_OSM_CACHE_DIR } from '../../shared/germanyOsmPbf.ts'
import { resolveOfficialProfile } from '../../shared/officialProfiles.ts'
import { resolveOsmProfile } from '../../shared/osmProfiles.ts'
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
  | 'text'

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
  profileId: string
  /** Property on OSM features used as matching key (for example `de:regionalschluessel`, `postal_code`). */
  matchProperty: string
  /**
   * Optional alternate matching criteria.
   * - `property`: match on a property value (default behavior).
   * - `relation_id`: match only selected relation IDs using `@id` (for example `relation/51477`).
   */
  matchCriteria?: { kind: 'property' } | { kind: 'relation_id'; relationIds: string[] }
  /** Optional OSM admin_level values to include (for example ["10"]). */
  adminLevels?: string[]
  /** Optional OSM relation IDs (numeric strings) to exclude from compare. */
  ignoreRelationIds?: string[]
  /** Basename under `.cache/osm` resolved from `osmProfile`. */
  sharedFgbBasename: string
}

function parseNumericIdStringArray(
  areaLabel: string,
  raw: unknown,
  fieldPath: string,
): string[] | undefined {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) {
    throw new Error(`${areaLabel}: ${fieldPath} must be an array`)
  }
  const values = raw.map((value) => String(value).trim()).filter((value) => value.length > 0)
  if (values.length === 0) {
    throw new Error(`${areaLabel}: ${fieldPath} must contain non-empty values`)
  }
  const invalid = values.find((value) => !/^\d+$/.test(value))
  if (invalid) {
    throw new Error(
      `${areaLabel}: ${fieldPath} must contain numeric relation ID strings (invalid: "${invalid}")`,
    )
  }
  return values
}

/** Paths under the area folder for official input; OSM path/key are configurable. */
export type BoundaryConfig = {
  /** Dataset-specific feature title prefix (for example "Postleitzahl"). */
  titlePrefix: string
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

function toCompareConfig(compare: DatasetConfig['compare']): CompareConfig {
  return {
    bboxFilter: compare.bboxFilter,
    ...(compare.bboxBufferDegrees !== undefined
      ? { bboxBufferDegrees: compare.bboxBufferDegrees }
      : {}),
    osmScopeFilter: compare.osmScopeFilter,
  }
}

function parseOsmConfig(areaLabel: string, config: DatasetConfig): OsmConfig {
  const profile = resolveOsmProfile(config.osmProfile)
  const osmConfig = config.osm
  const matchCriteriaRaw = osmConfig?.matchCriteria
  let matchCriteria: OsmConfig['matchCriteria'] | undefined
  if (matchCriteriaRaw !== undefined) {
    if (matchCriteriaRaw.kind === 'property') {
      matchCriteria = { kind: 'property' }
    } else if (matchCriteriaRaw.kind === 'relation_id') {
      matchCriteria = { kind: 'relation_id', relationIds: matchCriteriaRaw.relationIds }
    } else {
      throw new Error(`${areaLabel}: osm.matchCriteria.kind must be "property" or "relation_id"`)
    }
  }
  const ignoreRelationIds = parseNumericIdStringArray(
    areaLabel,
    osmConfig?.ignoreRelationIds,
    'osm.ignoreRelationIds',
  )
  const adminLevels = parseNumericIdStringArray(areaLabel, osmConfig?.adminLevels, 'osm.adminLevels')

  return {
    profileId: config.osmProfile,
    matchProperty: profile.matchProperty,
    ...(matchCriteria ? { matchCriteria } : {}),
    ...(adminLevels ? { adminLevels } : {}),
    ...(ignoreRelationIds ? { ignoreRelationIds } : {}),
    sharedFgbBasename: profile.sharedFgbBasename,
  }
}

export function loadBoundaryConfig(config: DatasetConfig, areaLabel = 'area'): BoundaryConfig {
  const matchProperty = config.compare.officialMatchProperty
  const directOfficial = config.officialMode === 'direct' ? config.official : null

  const keyTransposition = parseOfficialKeyTransposition(
    areaLabel,
    matchProperty,
    directOfficial?.keyTransposition,
  )

  const compare = toCompareConfig(config.compare)
  const osm = parseOsmConfig(areaLabel, config)
  const officialProfile =
    config.officialMode === 'profile' ? resolveOfficialProfile(config.officialProfile) : null

  return {
    titlePrefix: config.titlePrefix,
    official: {
      path: officialProfile ? 'source/official.fgb' : directOfficial!.path,
      matchProperty,
      ...(officialProfile?.extractLayer === 'vg25_sta' ? { constantMatchKey: '51477' } : {}),
      ...(directOfficial?.constantMatchKey
        ? { constantMatchKey: directOfficial.constantMatchKey }
        : {}),
      ...(keyTransposition ? { keyTransposition } : {}),
    },
    osm,
    compare,
    idNormalization: { preset: config.idNormalization.preset },
    metricsCrs: config.metricsCrs,
  }
}

/** Runtime-root path for configured OSM FlatGeobuf. */
export function osmFgbPathFromConfig(runtimeRoot: string, osm: OsmConfig): string {
  return join(runtimeRoot, GERMANY_OSM_CACHE_DIR, osm.sharedFgbBasename)
}
