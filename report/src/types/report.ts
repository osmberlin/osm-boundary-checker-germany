import type { AttributeCheckConfig } from '../../../scripts/shared/attributeChecks.ts'
import type {
  IdNormalizationPreset,
  LicenseBreakdownEntry,
  OfficialLicense,
  OsmMatchCriteriaSummary,
} from '../../../scripts/shared/comparisonPayload.ts'
import type { MatchedBy, MatchRule } from '../../../scripts/shared/matchRules.ts'
import type { RowFlagDefinition } from '../../../scripts/shared/rowFlags.ts'
import type { SourceKind } from '../../../scripts/shared/sourceKind.ts'
import type {
  DatasetLicenseId,
  OsmLicenseCompatibility,
  OsmSourceMetadataPersisted,
} from '../../../scripts/shared/sourceMetadata.ts'

export type { LicenseBreakdownEntry }

export type ReportCategory = 'matched' | 'official_only' | 'unmatched_osm'
export type OverpassBoundaryTag = 'administrative' | 'postal_code' | 'protected_area'

export type ReportMetrics = {
  iou: number
  areaDiffPct: number
  symmetricDiffPct: number
  hausdorffM: number
  hausdorffP95M?: number
  hausdorffNorm?: number
  issueIndicator?: {
    level: 'ok' | 'review' | 'issue'
    reasons: Array<
      | 'STRONG_OVERLAP_LOW_DIFF'
      | 'BOUNDARY_OUTLIER_BUT_OVERLAP_STABLE'
      | 'LOW_IOU_HIGH_SYM_DIFF'
      | 'HIGH_AREA_DELTA'
      | 'BASELINE_ANOMALY_IOU_DELTA'
      | 'BASELINE_ANOMALY_SYMDIFF_DELTA'
      | 'BASELINE_ANOMALY_AREA_DELTA'
      | 'BASELINE_ANOMALY_HAUSDORFF_NORM_DELTA'
    >
  }
  officialAreaM2: number
  osmAreaM2: number
}

export type SourceMetadataSide = {
  downloadedAt?: string
  sourcePublishedAt?: string
  sourceUpdatedAt?: string
  sourceUpdatedAtVerifiedAt?: string
  sourceDateSource?:
    | 'wfs_capabilities'
    | 'bkg_gdz_aktualitaetsstand'
    | 'ogc_api_features_collection'
    | 'osm_pbf_header'
    | 'dtp_api_updated_at'
    | 'manual_override'
    | 'unknown'
  provider?: string
  dataset?: string
  layer?: string
  sourcePublicUrl: string
  sourceDownloadUrl: string
  note?: string
  licenseId?: DatasetLicenseId
  licenseLabel?: string
  licenseSourceUrl?: string
  /** `partial` only on dataset level when rows carry their own licence (`officialLicense`). */
  osmCompatibility?: OsmLicenseCompatibility
  osmCompatibilitySourceUrl?: string
  osmCompatibilityComment?: string
  license?: string
}

export type OfficialExtractFilterSummary = {
  property: string
  valuePrefix: string
}

export type ComparisonFilterConfigSummary = {
  officialMatchProperty: string
  bboxFilter: 'none' | 'official_bbox_overlap'
  bboxBufferDegrees?: number
  osmScopeFilter: 'none' | 'intersects_official_coverage'
  adminLevels?: string[]
  ignoreRelationIds?: string[]
  officialExtractLayer?: string
  /** Direct-mode subset of the official export before compare (`official.extractFilter`). */
  officialExtractFilter?: OfficialExtractFilterSummary
  /** Ordered OSM tags used as match keys (e.g. `de:regionalschluessel` for `admin_rs`). */
  osmMatchProperties?: string[]
  /** From `compare.minZoom` in area config. */
  minZoom: number
}

/** WFS source for live property loading (mirrors `ogcInspectSources` in area config). */
export type OgcWfsInspectSource = {
  id: string
  label: string
  type: 'wfs'
  baseUrl: string
  typeName: string
  wfsVersion?: '1.1.0' | '2.0.0'
  bboxAxisOrder?: 'lonlat' | 'latlon'
  srsName?: string
  outputFormat?: string
  maxFeatures?: number
}

/** Main compare table: BKG-export–first rows only. */
export type ReportRow = {
  canonicalMatchKey: string
  nameLabel: string
  category: ReportCategory
  /**
   * Matched rows: the rule (position in `matchRules`) that paired the row with its OSM object.
   * The feature shard has it for every matched row, the table only for rows not paired by key.
   */
  matchedBy?: MatchedBy
  osmRelationId: string
  metrics: ReportMetrics | null
  /** WGS84 bbox [west, south, east, north] for fitting the map; null if no geometry. */
  mapBbox: [number, number, number, number] | null
  /** Relative to the dataset folder: `output/official_for_edit/<basename>.geojson` or null. */
  officialForEditPath: string | null
  /** Feature shard only (matched rows): WGS84 bbox of the official geometry. */
  officialBbox?: [number, number, number, number]
  /** Feature shard only (matched rows): WGS84 bbox of the OSM geometry. */
  osmBbox?: [number, number, number, number]
  /** GeoJSON properties from the compare merge (official side). */
  officialProperties: Record<string, unknown> | null
  /** GeoJSON properties from the compare merge (OSM). */
  osmProperties: Record<string, unknown> | null
  /** Official ARS is outdated; successor is already current in Destatis/OSM. */
  staleOfficialKey?: {
    toArs: string
    source: 'successor_table' | 'ags_candidate' | 'osm_map'
    pairedUnmatchedKey?: string
  }
  /** Ids of the `rowFlags` (see `ComparisonForReport.rowFlags`) that apply to this row. */
  flags?: string[]
  /** Same-area unmatched OSM row that is the successor of a stale official key. */
  staleOfficialPredecessor?: {
    fromArs: string
  }
  /**
   * Licence of this geometry (DtP); absent for datasets with one licence per dataset.
   * Only in feature shards.
   */
  officialLicense?: OfficialLicense
}

/** OSM polygon whose normalized `de:regionalschluessel` has no row in this area’s official export. */
export type UnmatchedOsmReportRow = {
  canonicalMatchKey: string
  nameLabel: string
  osmRelationId: string
  adminLevel: string | null
  mapBbox: [number, number, number, number] | null
  staleOfficialPredecessor?: {
    fromArs: string
  }
}

/** Unified table/view model on `/$areaId` (main + unmatched rows). */
export type AreaReportRow = ReportRow

/** Slim compare result JSON (`output/comparison_table.json`). */
export type ComparisonForReport = {
  area: string
  displayName: string
  titlePrefix: string
  generatedAt: string
  metricsCrs: string
  /** Wording of the official side (`sourceVocabulary`); absent means `official`. */
  sourceKind?: SourceKind
  /** Overpass `boundary=*` value for live OSM lookup; defaults to `administrative` when absent. */
  overpassBoundaryTag?: OverpassBoundaryTag
  /** Overlay + split diff archives (`comparison.pmtiles` / `comparison-diff.pmtiles`) when true. */
  hasPmtiles: boolean
  /** PMTiles for `unmatchedOsm` geometries (`output/unmatched.pmtiles`), when non-empty. */
  hasUnmatchedPmtiles?: boolean
  /** MapLibre `source-layer` name (matches tippecanoe `-l`). */
  tippecanoeLayer: string
  /**
   * Embedded at compare time. `official` is full provenance from the official vendor source.
   * `osm` is slim (`downloadedAt`, optional `extractedAt`, `sourceDateSource`); URLs and licence come from
   * `GERMANY_OSM_SOURCE_DEFAULTS` — merge in the UI via `buildResolvedOsmSourceSide` (see
   * `scripts/shared/osmGermanyProvenance.ts`).
   */
  sourceMetadata: {
    official: SourceMetadataSide
    osm: OsmSourceMetadataPersisted
    /** One entry per geometry source × licence, sorted by `rowCount` descending; datasets with `officialLicense` rows only. */
    licenseBreakdown?: LicenseBreakdownEntry[]
  }
  /** Compact compare filter summary from `<area>/config.jsonc` (includes `minZoom`). */
  filterConfigSummary: ComparisonFilterConfigSummary
  /** From `idNormalization.preset` in area config; one value per `comparison_table.json`. */
  idNormalizationPreset?: IdNormalizationPreset
  /** The ordered match rules of the dataset; absent in tables written before the rules existed. */
  matchRules?: MatchRule[]
  /** Written before `matchRules` existed (from `osm.matchCriteria`). */
  osmMatchCriteria?: OsmMatchCriteriaSummary
  /** From optional `ogcInspectSources` in area config (compare embeds a copy). */
  ogcInspectSources?: OgcWfsInspectSource[]
  /** From optional `rowFlags` in area config: badge definitions with the number of flagged rows. */
  rowFlags?: RowFlagDefinition[]
  /** From optional `compare.attributeChecks` in area config. */
  attributeChecks?: AttributeCheckConfig[]
  rows: ReportRow[]
  unmatchedOsm: UnmatchedOsmReportRow[]
}

export type SnapshotsJson = {
  area: string
  metricsCrs: string
  runs: {
    id: string
    summary: {
      totalRows: number
      meanIou: number
      matched: number
      unmatchedOsm: number
      issues?: number
      reviews?: number
      staleOfficialKey?: number
    }
  }[]
}

/**
 * Candidate OSM feature attached to an `official_only` row by the additive
 * `match_candidates` compare phase. Mirrors `candidateMatchSchema` in
 * `scripts/shared/comparisonPayload.ts`. Stored only in the per-feature shard so the
 * main `comparison_table.json` stays slim.
 */
export type CandidateMatch = {
  osmType: 'way' | 'relation'
  osmId: string
  name: string | null
  /** Admin profile only. */
  adminLevel?: string | null
  /** Admin profile only. */
  deRegionalRaw?: string | null
  /** Admin profile only. */
  deAgsRaw?: string | null
  /** Postal code profile only. */
  postalCodeRaw?: string | null
  /** Protected-area profile: signals that found this candidate, strongest first. */
  signals?: CandidateSignalId[]
  /** Protected-area profile: normalized name similarity 0..1. */
  nameSimilarity?: number
  /** Protected-area profile: current tags on the candidate (null = tag missing). */
  refWdpa?: string | null
  wikidata?: string | null
  protectionTitle?: string | null
  protectClass?: string | null
  /** Protected-area profile: tags to add to the OSM object, key → value. */
  suggestedTags?: Record<string, string>
  /** Protected-area profile: the candidate's OSM tags (flat key → value). */
  tags?: Record<string, string>
}

export type CandidateSignalId =
  | 'dtp_id'
  | 'dtp_osm_ref'
  | 'wikidata'
  | 'natura2000'
  | 'inside'
  | 'name'

export type AttributeHintId =
  | 'type_tags'
  | 'wikidata_missing'
  | 'wikidata_differs'
  | 'osm_ref_differs'
  | 'natura2000_missing'
  | 'wdpa_missing_in_dtp'
  | 'wdpa_missing_in_osm'
  | 'wdpa_differs'

/** Tag suggestion for a matched protected-area row. Mirrors `attributeHintSchema`. */
export type AttributeHint = {
  id: AttributeHintId
  /** Expected `key=value` strings (`type/id` for `osm_ref_differs`). */
  expected: string[]
  /** Current OSM values for the same keys; empty = missing. */
  actual: string[]
  suggestedTags?: Record<string, string>
  /** `osm`: a suggestion for the OSM object; `reference`: a note for the reference data (DtP). */
  target: 'osm' | 'reference'
}

/** Slim per-feature shard at `output/features/<featureKey>.json`. */
export type FeatureDetailShard = {
  row: ReportRow
  /**
   * Optional candidate matches (only for `official_only` rows). Empty array = phase ran
   * and produced no matches; absent = phase skipped (e.g. matched row, candidate FGB
   * missing).
   */
  candidates?: CandidateMatch[]
  /** Matched protected-area rows: tag suggestions; absent when there are none. */
  attributeHints?: AttributeHint[]
}
