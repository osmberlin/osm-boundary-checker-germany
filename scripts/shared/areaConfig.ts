import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { parseDatasetConfig, type DatasetConfig } from './datasetConfig.ts'
import { DATASETS_DIRECTORY, datasetFolderPath } from './datasetPaths.ts'

export const AREA_CONFIG_JSONC = 'config.jsonc'

function parseJsonc(text: string): unknown {
  return Bun.JSONC.parse(text)
}

const nonEmptyStringArraySchema = z.array(z.string().trim().min(1))
const osmExtractConfigSchema = z
  .object({
    selectProperties: nonEmptyStringArraySchema.optional(),
    includeRelationIds: nonEmptyStringArraySchema.optional(),
    additionalWhereClauses: nonEmptyStringArraySchema.optional(),
    tagsFilterExpressions: nonEmptyStringArraySchema.optional(),
  })
  .refine(
    (extract) =>
      extract.selectProperties !== undefined ||
      extract.includeRelationIds !== undefined ||
      extract.additionalWhereClauses !== undefined ||
      extract.tagsFilterExpressions !== undefined,
    { message: 'osm.extract must include at least one extract override field' },
  )

const osmExtractPresenceSchema = z
  .object({
    osm: z
      .object({
        extract: osmExtractConfigSchema,
      })
      .passthrough(),
  })
  .passthrough()

/** True if the area has compare inputs configured. */
export function areaHasCompareConfig(workspaceRoot: string, area: string): boolean {
  const base = datasetFolderPath(workspaceRoot, area)
  return existsSync(join(base, AREA_CONFIG_JSONC))
}

export function loadAreaConfig(workspaceRoot: string, area: string): DatasetConfig {
  const base = datasetFolderPath(workspaceRoot, area)
  const jsoncPath = join(base, AREA_CONFIG_JSONC)
  if (!existsSync(jsoncPath)) {
    throw new Error(`Missing ${DATASETS_DIRECTORY}/${area}/${AREA_CONFIG_JSONC}`)
  }
  const text = readFileSync(jsoncPath, 'utf-8')
  try {
    const raw = parseJsonc(text)
    return parseDatasetConfig(area, raw)
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
    const parsed = loadAreaConfig(workspaceRoot, area)
    return osmExtractPresenceSchema.safeParse(parsed).success
  } catch {
    return false
  }
}
