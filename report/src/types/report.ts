export type ReportCategory = 'matched' | 'official_only' | 'unmatched_osm'
export type OverpassBoundaryTag = 'administrative' | 'postal_code'

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
  sourceDateSource?:
    | 'wfs_capabilities'
    | 'bkg_download_metadata'
    | 'osm_pbf_header'
    | 'manual_override'
    | 'unknown'
  provider?: string
  dataset?: string
  layer?: string
  sourcePublicUrl: string
  sourceDownloadUrl: string
  note?: string
  licenseId?:
    | 'unknown'
    | 'odbl_10'
    | 'cc_by_30'
    | 'cc_by_40'
    | 'cc0_10'
    | 'dl_de_by_20'
    | 'dl_de_zero_20'
    | 'custom'
  licenseLabel?: string
  licenseSourceUrl?: string
  osmCompatibility?: 'unknown' | 'no' | 'yes_licence' | 'yes_waiver'
  osmCompatibilitySourceUrl?: string
  osmCompatibilityComment?: string
  license?: string
}

export type ComparisonFilterConfigSummary = {
  officialMatchProperty: string
  bboxFilter: 'none' | 'official_bbox_overlap'
  bboxBufferDegrees?: number
  osmScopeFilter: 'none' | 'centroid_in_official_coverage'
  ignoreRelationIds?: string[]
  officialExtractLayer?: string
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
  osmRelationId: string
  metrics: ReportMetrics | null
  /** WGS84 bbox [west, south, east, north] for fitting the map; null if no geometry. */
  mapBbox: [number, number, number, number] | null
  /** Relative to the dataset folder: `output/official_for_edit/<basename>.geojson` or null. */
  officialForEditPath: string | null
  /** GeoJSON properties from the compare merge (amtlich). */
  officialProperties: Record<string, unknown> | null
  /** GeoJSON properties from the compare merge (OSM). */
  osmProperties: Record<string, unknown> | null
}

/** OSM polygon whose normalized `de:regionalschluessel` has no row in this area’s official export. */
export type UnmatchedOsmReportRow = {
  canonicalMatchKey: string
  nameLabel: string
  osmRelationId: string
  adminLevel: string | null
  mapBbox: [number, number, number, number] | null
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
  /** Overpass `boundary=*` value for live OSM lookup; defaults to `administrative` when absent. */
  overpassBoundaryTag?: OverpassBoundaryTag
  hasPmtiles: boolean
  /** PMTiles for `unmatchedOsm` geometries (`output/unmatched.pmtiles`), when non-empty. */
  hasUnmatchedPmtiles?: boolean
  /** MapLibre `source-layer` name (matches tippecanoe `-l`). */
  tippecanoeLayer: string
  /** Always embedded from `<area>/source/metadata.json` at compare time. */
  sourceMetadata: {
    official: SourceMetadataSide
    osm: SourceMetadataSide
  }
  /** Optional compact compare filter summary from `<area>/config.jsonc`. */
  filterConfigSummary?: ComparisonFilterConfigSummary
  /** From optional `ogcInspectSources` in area config (compare embeds a copy). */
  ogcInspectSources?: OgcWfsInspectSource[]
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
    }
  }[]
}

/** Slim per-feature shard at `output/features/<featureKey>.json`. */
export type FeatureDetailShard = {
  row: ReportRow
}
