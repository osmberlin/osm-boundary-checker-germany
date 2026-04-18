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
  /** Present when `<area>/source/metadata.json` was read at compare time. */
  sourceMetadata?: {
    official: SourceMetadataSide | null
    osm: SourceMetadataSide | null
  }
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
    }
  }[]
}
