import { join } from 'node:path'
import type { DatasetConfig } from '../../shared/datasetConfig.ts'
import { OFFICIAL_SOURCE_RELATIVE_PATH } from '../../shared/datasetPaths.ts'
import { normalizeExtractFilter } from '../../shared/extractFilter.ts'
import { GERMANY_OSM_CACHE_DIR } from '../../shared/germanyOsmPbf.ts'
import {
  type MatchRule,
  resolveMatchRules,
  resolveOfficialMatchProperty,
} from '../../shared/matchRules.ts'
import { resolveOfficialProfile } from '../../shared/officialProfiles.ts'
import { resolveOsmProfile, type OsmProfileId } from '../../shared/osmProfiles.ts'
import {
  type OfficialKeyTransposition,
  parseOfficialKeyTransposition,
} from './officialKeyTransposition.ts'
import type { OfficialExtractFilter } from './unmatchedOsmPrefixScope.ts'

export type IdNormalizationPreset =
  | 'berlin-bezirk-rs5'
  | 'amtlicher-8'
  | 'regional-12'
  | 'plz-5'
  | 'text'
  | 'wdpa'

/** Optional compare tuning (bbox prefilter, etc.). */
export type CompareConfig = {
  /** OSM bbox prefilter strategy before key matching. */
  bboxFilter: 'none' | 'official_bbox_overlap'
  /** Pad official bbox in degrees (required when bboxFilter=official_bbox_overlap). */
  bboxBufferDegrees?: number
  /** Geometric scope filter for OSM features after bbox prefilter. */
  osmScopeFilter: 'none' | 'intersects_official_coverage'
  /** Linear shrink factor (0..1] applied to each official_only polygon for candidate matching. */
  candidateShrinkFactor?: number
  /** Lowest zoom for vector tiles and map UI (see `compare.minZoom` in dataset config). */
  minZoom: number
}

export type OsmConfig = {
  profileId: OsmProfileId
  /** Property on OSM features used as matching key (for example `de:regionalschluessel`, `postal_code`). */
  matchProperty: string
  /** Optional OSM admin_level values to include (for example ["10"]). */
  adminLevels?: string[]
  /** Optional OSM relation IDs (numeric strings) to exclude from compare. */
  ignoreRelationIds?: string[]
  /**
   * DtP category ids whose type scope (union) filters `unmatchedOsm`; unset = no type scope.
   * Derived from `official.dtp.categoryIds` unless `osm.protectedAreaTypeScope` is `false`.
   */
  protectedAreaCategoryIds?: number[]
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
    /** Direct-mode official extract prefix (`ARS LIKE '09%'`). Used to scope unmatched OSM. */
    extractFilter?: OfficialExtractFilter
  }
  osm: OsmConfig
  compare: CompareConfig
  idNormalization: { preset: IdNormalizationPreset }
  metricsCrs: string
  /** Ordered rules that pair an official row with its OSM object (`compare.matchRules`, or derived). */
  matchRules: MatchRule[]
}

function toCompareConfig(compare: DatasetConfig['compare']): CompareConfig {
  return {
    bboxFilter: compare.bboxFilter,
    ...(compare.bboxBufferDegrees !== undefined
      ? { bboxBufferDegrees: compare.bboxBufferDegrees }
      : {}),
    osmScopeFilter: compare.osmScopeFilter,
    ...(compare.candidateShrinkFactor !== undefined
      ? { candidateShrinkFactor: compare.candidateShrinkFactor }
      : {}),
    minZoom: compare.minZoom,
  }
}

function parseOsmConfig(areaLabel: string, config: DatasetConfig): OsmConfig {
  const profile = resolveOsmProfile(config.osmProfile)
  const osmConfig = config.osm
  const ignoreRelationIds = parseNumericIdStringArray(
    areaLabel,
    osmConfig?.ignoreRelationIds,
    'osm.ignoreRelationIds',
  )
  const adminLevels = parseNumericIdStringArray(
    areaLabel,
    osmConfig?.adminLevels,
    'osm.adminLevels',
  )

  if (osmConfig?.protectedAreaTypeScope === true && config.officialMode !== 'dtp') {
    throw new Error(`${areaLabel}: osm.protectedAreaTypeScope requires a DtP official profile`)
  }
  const protectedAreaCategoryIds =
    config.officialMode === 'dtp' && osmConfig?.protectedAreaTypeScope !== false
      ? [...config.official.dtp.categoryIds]
      : undefined

  return {
    profileId: config.osmProfile,
    matchProperty: profile.matchProperty,
    ...(protectedAreaCategoryIds ? { protectedAreaCategoryIds } : {}),
    ...(adminLevels ? { adminLevels } : {}),
    ...(ignoreRelationIds ? { ignoreRelationIds } : {}),
    sharedFgbBasename: profile.sharedFgbBasename,
  }
}

export function loadBoundaryConfig(config: DatasetConfig, areaLabel = 'area'): BoundaryConfig {
  const matchProperty = resolveOfficialMatchProperty(config)
  if (!matchProperty) {
    throw new Error(
      `${areaLabel}: compare.officialMatchProperty or a compare.matchRules key rule is required`,
    )
  }
  const directOfficial = config.officialMode === 'direct' ? config.official : null
  const extractFilter = normalizeExtractFilter(
    config.officialMode === 'dtp' ? undefined : config.official?.extractFilter,
  )

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
      path: OFFICIAL_SOURCE_RELATIVE_PATH,
      matchProperty,
      ...(officialProfile?.extractLayer === 'vg25_sta' ? { constantMatchKey: '51477' } : {}),
      ...(directOfficial?.constantMatchKey
        ? { constantMatchKey: directOfficial.constantMatchKey }
        : {}),
      ...(keyTransposition ? { keyTransposition } : {}),
      ...(extractFilter ? { extractFilter } : {}),
    },
    osm,
    compare,
    idNormalization: { preset: config.idNormalization.preset },
    metricsCrs: config.metricsCrs,
    matchRules: resolveMatchRules(config),
  }
}

/** Runtime-root path for configured OSM FlatGeobuf. */
export function osmFgbPathFromConfig(runtimeRoot: string, osm: OsmConfig): string {
  return join(runtimeRoot, GERMANY_OSM_CACHE_DIR, osm.sharedFgbBasename)
}
