import { listAreaSummaries } from './runtimeDataStore.ts'

/** Dataset slugs under `datasets/` that contain `output/comparison_table.json`. */
export function listComparisonAreas(runtimeRoot: string): string[] {
  return listAreaSummaries(runtimeRoot)
    .map((s) => s.area)
    .sort((a, b) => a.localeCompare(b))
}

export type AreaHomeSummary = {
  area: string
  matched: number
  officialOnly: number
  unmatchedOsm: number
}

/** Home-card summary per area from runtime DB. */
export function listComparisonAreaSummaries(runtimeRoot: string): AreaHomeSummary[] {
  return listAreaSummaries(runtimeRoot)
}
