import { existsSync, readdirSync } from 'node:fs'
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
