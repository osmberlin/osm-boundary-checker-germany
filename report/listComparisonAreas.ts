import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'

/** Dataset slugs under `datasets/` that contain `output/comparison_table.json`. */
export function listComparisonAreas(runtimeRoot: string): string[] {
  return listComparisonAreaSummaries(runtimeRoot)
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
  const datasetsRoot = join(runtimeRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: AreaHomeSummary[] = []
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const area = entry.name
    const tablePath = join(datasetsRoot, area, 'output', 'comparison_table.json')
    if (!existsSync(tablePath)) continue
    try {
      const parsed = JSON.parse(readFileSync(tablePath, 'utf-8')) as {
        rows?: Array<{ category?: unknown }>
        unmatchedOsm?: unknown[]
      }
      const rows = Array.isArray(parsed.rows) ? parsed.rows : []
      let matched = 0
      let officialOnly = 0
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue
        const c = (row as { category?: unknown }).category
        if (c === 'matched') matched++
        else if (c === 'official_only') officialOnly++
      }
      const unmatched = Array.isArray(parsed.unmatchedOsm) ? parsed.unmatchedOsm.length : 0
      out.push({ area, matched, officialOnly, unmatchedOsm: unmatched })
    } catch {
      // ignore malformed table file for this area
    }
  }
  return out.sort((a, b) => a.area.localeCompare(b.area))
}
