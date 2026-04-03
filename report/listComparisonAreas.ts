import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'

/** Dataset slugs under `datasets/` that contain `output/comparison_table.json`. */
export function listComparisonAreas(repoRoot: string): string[] {
  const datasetsRoot = join(repoRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: string[] = []
  for (const ent of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue
    if (ent.name.startsWith('.')) continue
    const table = join(datasetsRoot, ent.name, 'output', 'comparison_table.json')
    if (existsSync(table)) out.push(ent.name)
  }
  return out.sort()
}

export type AreaHomeSummary = {
  area: string
  matched: number
  officialOnly: number
  unmatchedOsm: number
}

type ComparisonTableLike = {
  rows?: unknown[]
  unmatchedOsm?: unknown[]
}

function parseAreaSummary(area: string, tablePath: string): AreaHomeSummary | null {
  try {
    const raw = JSON.parse(readFileSync(tablePath, 'utf-8')) as ComparisonTableLike
    const rows = Array.isArray(raw.rows) ? raw.rows : []
    let matched = 0
    let officialOnly = 0
    for (const row of rows) {
      const category =
        row && typeof row === 'object' ? (row as Record<string, unknown>).category : undefined
      if (category === 'matched') matched++
      if (category === 'official_only') officialOnly++
    }
    const unmatchedOsm = Array.isArray(raw.unmatchedOsm) ? raw.unmatchedOsm.length : 0
    return { area, matched, officialOnly, unmatchedOsm }
  } catch {
    return null
  }
}

/** Home-card summary per area from `output/comparison_table.json` (small payload for UI). */
export function listComparisonAreaSummaries(repoRoot: string): AreaHomeSummary[] {
  const datasetsRoot = join(repoRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: AreaHomeSummary[] = []
  for (const ent of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue
    if (ent.name.startsWith('.')) continue
    const table = join(datasetsRoot, ent.name, 'output', 'comparison_table.json')
    if (!existsSync(table)) continue
    const summary = parseAreaSummary(ent.name, table)
    if (summary) out.push(summary)
  }
  return out.sort((a, b) => a.area.localeCompare(b.area))
}
