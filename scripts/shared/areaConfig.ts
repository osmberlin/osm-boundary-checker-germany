import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATASETS_DIRECTORY, datasetFolderPath } from './datasetPaths.ts'

export const AREA_CONFIG_JSONC = 'config.jsonc'

function parseJsonc(text: string): unknown {
  return Bun.JSONC.parse(text)
}

/** True if the area has compare inputs configured. */
export function areaHasCompareConfig(workspaceRoot: string, area: string): boolean {
  const base = datasetFolderPath(workspaceRoot, area)
  return existsSync(join(base, AREA_CONFIG_JSONC))
}

export function loadAreaConfig(workspaceRoot: string, area: string): unknown {
  const base = datasetFolderPath(workspaceRoot, area)
  const jsoncPath = join(base, AREA_CONFIG_JSONC)
  if (!existsSync(jsoncPath)) {
    throw new Error(`Missing ${DATASETS_DIRECTORY}/${area}/${AREA_CONFIG_JSONC}`)
  }
  const text = readFileSync(jsoncPath, 'utf-8')
  try {
    return parseJsonc(text)
  } catch (e) {
    throw new Error(`${DATASETS_DIRECTORY}/${area}/${AREA_CONFIG_JSONC}: ${String(e)}`)
  }
}

/** Human-readable config path for errors. */
export function areaConfigPathForDisplay(workspaceRoot: string, area: string): string {
  return join(DATASETS_DIRECTORY, area, AREA_CONFIG_JSONC)
}

/** True if the area defines OSM PBF extraction in config.jsonc. */
export function areaHasOsmExtract(workspaceRoot: string, area: string): boolean {
  const base = datasetFolderPath(workspaceRoot, area)
  if (!existsSync(join(base, AREA_CONFIG_JSONC))) return false
  try {
    const doc = parseJsonc(readFileSync(join(base, AREA_CONFIG_JSONC), 'utf-8')) as Record<
      string,
      unknown
    >
    const oe = doc.osmExtract as Record<string, unknown> | undefined
    if (!oe || typeof oe !== 'object') return false
    const w = typeof oe.ogrWhere === 'string' && oe.ogrWhere.trim() !== ''
    const s = typeof oe.ogrSql === 'string' && oe.ogrSql.trim() !== ''
    return w || s
  } catch {
    return false
  }
}
