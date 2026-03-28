import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DATASETS_DIRECTORY, datasetFolderPath } from './datasetPaths.ts'

export const AREA_CONFIG_JSONC = 'config.jsonc'
export const LEGACY_BOUNDARY_CONFIG = 'boundary-config.json'
export const LEGACY_OSM_EXTRACT = 'osm-extract.json'

function parseJsonc(text: string): unknown {
  return Bun.JSONC.parse(text)
}

/** True if the area has compare inputs configured (new or legacy layout). */
export function areaHasCompareConfig(workspaceRoot: string, area: string): boolean {
  const base = datasetFolderPath(workspaceRoot, area)
  return existsSync(join(base, AREA_CONFIG_JSONC)) || existsSync(join(base, LEGACY_BOUNDARY_CONFIG))
}

/**
 * Load merged area config: `config.jsonc` (JSONC) or legacy `boundary-config.json`
 * plus optional `osm-extract.json` merged as `osmExtract`.
 */
export function loadAreaConfig(workspaceRoot: string, area: string): unknown {
  const base = datasetFolderPath(workspaceRoot, area)
  const jsoncPath = join(base, AREA_CONFIG_JSONC)
  const legacyPath = join(base, LEGACY_BOUNDARY_CONFIG)

  if (existsSync(jsoncPath)) {
    const text = readFileSync(jsoncPath, 'utf-8')
    try {
      return parseJsonc(text)
    } catch (e) {
      throw new Error(`${DATASETS_DIRECTORY}/${area}/${AREA_CONFIG_JSONC}: ${String(e)}`)
    }
  }

  if (!existsSync(legacyPath)) {
    throw new Error(
      `Missing ${DATASETS_DIRECTORY}/${area}/${AREA_CONFIG_JSONC} or ${DATASETS_DIRECTORY}/${area}/${LEGACY_BOUNDARY_CONFIG}`,
    )
  }

  const boundary = JSON.parse(readFileSync(legacyPath, 'utf-8')) as Record<string, unknown>
  const extractPath = join(base, LEGACY_OSM_EXTRACT)
  if (existsSync(extractPath)) {
    const osmExtract = JSON.parse(readFileSync(extractPath, 'utf-8'))
    return { ...boundary, osmExtract }
  }
  return boundary
}

/** Human-readable path for errors (prefer jsonc). */
export function areaConfigPathForDisplay(workspaceRoot: string, area: string): string {
  const base = datasetFolderPath(workspaceRoot, area)
  if (existsSync(join(base, AREA_CONFIG_JSONC))) {
    return join(DATASETS_DIRECTORY, area, AREA_CONFIG_JSONC)
  }
  return join(DATASETS_DIRECTORY, area, LEGACY_BOUNDARY_CONFIG)
}

/** True if the area defines OSM PBF extraction (config.osmExtract or legacy file). */
export function areaHasOsmExtract(workspaceRoot: string, area: string): boolean {
  const base = datasetFolderPath(workspaceRoot, area)
  if (existsSync(join(base, LEGACY_OSM_EXTRACT))) return true
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
