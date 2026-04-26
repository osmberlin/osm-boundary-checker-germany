import type { ComparisonForReport, ReportRow } from '../types/report'

function normalizeUnmatchedRows(data: ComparisonForReport): ReportRow[] {
  return data.unmatchedOsm.map((row) => ({
    canonicalMatchKey: row.canonicalMatchKey,
    nameLabel: row.nameLabel,
    category: 'unmatched_osm',
    osmRelationId: row.osmRelationId,
    metrics: null,
    mapBbox: row.mapBbox,
    officialForEditPath: null,
    officialProperties: null,
    osmProperties: {
      name: row.nameLabel,
      relation_id: row.osmRelationId,
      ...(row.adminLevel ? { admin_level: row.adminLevel } : {}),
    },
  }))
}

export function findFeatureDetailRow(
  data: ComparisonForReport,
  featureKey: string,
): ReportRow | null {
  const inMain = data.rows.find((row) => row.canonicalMatchKey === featureKey)
  if (inMain) return inMain
  return normalizeUnmatchedRows(data).find((row) => row.canonicalMatchKey === featureKey) ?? null
}
