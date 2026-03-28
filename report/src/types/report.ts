export type ReportMetrics = {
  iou: number
  areaDiffPct: number
  symmetricDiffPct: number
  hausdorffM: number
  officialAreaM2: number
  osmAreaM2: number
}

export type SourceMetadataSide = {
  downloadedAt?: string
  provider?: string
  dataset?: string
  layer?: string
  sourceUrl?: string
  note?: string
  license?: string
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
  category: 'matched' | 'official_only'
  osmRelationId: string
  metrics: ReportMetrics | null
  /** WGS84 bbox [west, south, east, north] for fitting the map; null if no geometry. */
  mapBbox: [number, number, number, number] | null
  /**
   * Relative to the dataset folder: `output/official_for_edit/<basename>.geojson`.
   * Omitted or null when there is no official geometry for this row, or in historic table-only snapshots.
   */
  officialForEditPath?: string | null
}

/** OSM polygon whose normalized `de:regionalschluessel` has no row in this area’s official export. */
export type UnmatchedOsmReportRow = {
  canonicalMatchKey: string
  nameLabel: string
  osmRelationId: string
  adminLevel: string | null
  mapBbox: [number, number, number, number] | null
}

/** Slim compare result JSON (`output/comparison_table.json`). */
export type ComparisonForReport = {
  area: string
  generatedAt: string
  metricsCrs: string
  hasPmtiles: boolean
  /** PMTiles for `unmatchedOsm` geometries (`output/unmatched.pmtiles`), when non-empty. */
  hasUnmatchedPmtiles?: boolean
  /** MapLibre `source-layer` name (matches tippecanoe `-l`). */
  tippecanoeLayer: string
  /** Present when `<area>/source/metadata.json` (or legacy `source-metadata.json`) was read at compare time. */
  sourceMetadata?: {
    official: SourceMetadataSide | null
    osm: SourceMetadataSide | null
  }
  /** From optional `ogcInspectSources` in area config (compare embeds a copy). */
  ogcInspectSources?: OgcWfsInspectSource[]
  rows: ReportRow[]
  /** Default `[]` when missing (older JSON). */
  unmatchedOsm?: UnmatchedOsmReportRow[]
}

export type SnapshotsJson = {
  area: string
  metricsCrs: string
  runs: {
    id: string
    tablePath: string
    pmtilesPath: string | null
    summary: {
      totalRows: number
      meanIou: number
      matched: number
      /** Present from compare runs that emit `unmatchedOsm`; omit on older snapshots. */
      unmatchedOsm?: number
    }
  }[]
}
