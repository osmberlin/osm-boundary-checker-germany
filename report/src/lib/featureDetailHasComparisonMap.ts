import type { ComparisonForReport, ReportRow } from '../types/report'

/** Same predicate as the feature detail map: comparison PMTiles exist for this row. */
export function featureDetailHasComparisonMap(row: ReportRow, data: ComparisonForReport): boolean {
  return row.category === 'unmatched_osm' ? data.hasUnmatchedPmtiles === true : data.hasPmtiles
}
