import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { areaHasCompareConfig, loadAreaConfig } from './areaConfig.ts'
import { parseDatasetConfig } from './datasetConfig.ts'
import { DATASETS_DIRECTORY } from './datasetPaths.ts'

/** Dataset folders whose official geometry is produced by `extract:bkg`. */
export function discoverBkgAreaFolderNames(workspaceRoot: string): string[] {
  const datasetsRoot = join(workspaceRoot, DATASETS_DIRECTORY)
  const out: string[] = []
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const area = entry.name
    if (!areaHasCompareConfig(workspaceRoot, area)) continue
    const doc = loadAreaConfig(workspaceRoot, area) as Record<string, unknown>
    const parsed = parseDatasetConfig(area, doc)
    if (parsed.officialMode === 'profile') {
      out.push(area)
      continue
    }
    const extractFilter = parsed.official.extractFilter
    if (!extractFilter) continue
    if (parsed.compare.officialMatchProperty !== 'ARS') continue
    out.push(area)
  }
  return out.sort((a, b) => a.localeCompare(b))
}
