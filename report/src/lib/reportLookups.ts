import { areasIndex } from '../data/areasIndex'
import type { ComparisonForReport } from '../types/report'

const areaDisplayNameById = new Map(
  areasIndex.summaries.map((summary) => [summary.area, summary.displayName]),
)

export function areaDisplayNameForId(areaId: string): string {
  return areaDisplayNameById.get(areaId) ?? areaId
}

export function featureNameLabelFromData(
  data: ComparisonForReport,
  featureKey: string,
): string | null {
  return (
    data.rows.find((entry) => entry.canonicalMatchKey === featureKey)?.nameLabel ??
    data.unmatchedOsm.find((entry) => entry.canonicalMatchKey === featureKey)?.nameLabel ??
    null
  )
}
