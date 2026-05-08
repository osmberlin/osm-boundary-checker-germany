import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { loadBoundaryConfig } from '../compare/lib/config.ts'
import { loadAreaConfig } from '../shared/areaConfig.ts'
import type { DatasetConfig } from '../shared/datasetConfig.ts'
import { DATASETS_DIRECTORY, datasetFolderPath } from '../shared/datasetPaths.ts'
import {
  DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS,
  GERMANY_OSM_SHARED_FGB_BASENAME,
} from '../shared/germanyOsmPbf.ts'

export type OsmExtractOverrideConfig = {
  selectProperties?: string[]
  includeRelationIds?: string[]
  additionalWhereClauses?: string[]
  tagsFilterExpressions?: string[]
}

export type SharedAdminOsmExtractConfig = {
  selectProperties: string[]
  includeRelationIds: string[]
  additionalWhereClauses: string[]
  tagsFilterExpressions: string[]
}

/** Inputs needed for the admin candidates points-only extract (union over all areas). */
export type SharedAdminCandidatesExtractConfig = {
  /** Sorted, deduped admin_level values across all areas using the shared admin FGB. */
  adminLevels: string[]
  tagsFilterExpressions: string[]
}

const NonEmptyStringArraySchema = z.array(z.string().trim().min(1))
const OsmExtractOverrideSchema = z
  .object({
    selectProperties: NonEmptyStringArraySchema.optional(),
    includeRelationIds: NonEmptyStringArraySchema.optional(),
    additionalWhereClauses: NonEmptyStringArraySchema.optional(),
    tagsFilterExpressions: NonEmptyStringArraySchema.optional(),
  })
  .strict()
const OsmObjectSchema = z
  .object({
    extract: OsmExtractOverrideSchema.optional(),
  })
  .passthrough()

function discoverAreaFolders(workspaceRoot: string): string[] {
  const datasetsRoot = join(workspaceRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: string[] = []
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    if (existsSync(join(datasetFolderPath(workspaceRoot, entry.name), 'config.jsonc'))) {
      out.push(entry.name)
    }
  }
  return out.sort()
}

function issuePath(issue: z.core.$ZodIssue): string {
  if (issue.path.length === 0) return '(root)'
  return issue.path.map(String).join('.')
}

function parseWithSchema<T>(area: string, schema: z.ZodType<T>, raw: unknown, label: string): T {
  const parsed = schema.safeParse(raw)
  if (parsed.success) return parsed.data
  const details = parsed.error.issues
    .map((issue) => `${label}.${issuePath(issue)}: ${issue.message}`)
    .join('; ')
  throw new Error(`${area}: ${details}`)
}

function parseAreaExtractOverride(area: string, rawDoc: DatasetConfig): OsmExtractOverrideConfig {
  const osm = rawDoc.osm as unknown
  if (osm === undefined) return {}
  const osmObj = parseWithSchema(area, OsmObjectSchema, osm, 'osm')
  return osmObj.extract ?? {}
}

function addAll(target: Set<string>, values: string[]): void {
  for (const value of values) target.add(value)
}

export function loadSharedAdminOsmExtractConfig(
  workspaceRoot: string,
): SharedAdminOsmExtractConfig {
  const propertySet = new Set<string>(['name', 'admin_level', 'de:regionalschluessel'])
  const relationIdSet = new Set<string>()
  const whereClauseSet = new Set<string>()
  const tagsFilterSet = new Set<string>(DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS)

  for (const area of discoverAreaFolders(workspaceRoot)) {
    const rawDoc = loadAreaConfig(workspaceRoot, area)
    const boundary = loadBoundaryConfig(rawDoc, area)
    // `admin_name` shares the same admin FlatGeobuf as `admin_rs`. Include its matchProperty
    // so optional tags (e.g. `de:amtlicher_gemeindeschluessel`) stay available in the extract.
    const usesSharedAdminFgb = boundary.osm.sharedFgbBasename === GERMANY_OSM_SHARED_FGB_BASENAME
    if (!usesSharedAdminFgb) continue

    if (boundary.osm.matchCriteria?.kind !== 'relation_id') {
      propertySet.add(boundary.osm.matchProperty)
    } else {
      addAll(relationIdSet, boundary.osm.matchCriteria.relationIds)
    }

    const override = parseAreaExtractOverride(area, rawDoc)
    addAll(propertySet, override.selectProperties ?? [])
    addAll(relationIdSet, override.includeRelationIds ?? [])
    addAll(whereClauseSet, override.additionalWhereClauses ?? [])
    addAll(tagsFilterSet, override.tagsFilterExpressions ?? [])
  }

  const selectProperties = Array.from(propertySet)
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  const includeRelationIds = Array.from(relationIdSet)
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  const additionalWhereClauses = Array.from(whereClauseSet)
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
  const tagsFilterExpressions = Array.from(tagsFilterSet)
    .map((v) => v.trim())
    .filter((v) => v.length > 0)

  if (selectProperties.length === 0 && includeRelationIds.length === 0) {
    throw new Error('Shared admin extract has no configured match properties or relation IDs')
  }

  return {
    selectProperties,
    includeRelationIds,
    additionalWhereClauses,
    tagsFilterExpressions,
  }
}

/**
 * Collect the admin_level values configured by any area whose OSM matchProperty resolves
 * to the shared admin FGB. Used to constrain the points-only candidates extract so we
 * only carry features at `admin_level` values some compare actually cares about.
 */
export function loadSharedAdminCandidatesExtractConfig(
  workspaceRoot: string,
): SharedAdminCandidatesExtractConfig {
  const adminLevelSet = new Set<string>()
  const tagsFilterSet = new Set<string>(DEFAULT_OSM_TAGS_FILTER_EXPRESSIONS)

  for (const area of discoverAreaFolders(workspaceRoot)) {
    const rawDoc = loadAreaConfig(workspaceRoot, area)
    const boundary = loadBoundaryConfig(rawDoc, area)
    const usesSharedAdminFgb = boundary.osm.sharedFgbBasename === GERMANY_OSM_SHARED_FGB_BASENAME
    if (!usesSharedAdminFgb) continue
    for (const level of boundary.osm.adminLevels ?? []) {
      const trimmed = level.trim()
      if (trimmed.length > 0) adminLevelSet.add(trimmed)
    }
    const override = parseAreaExtractOverride(area, rawDoc)
    addAll(tagsFilterSet, override.tagsFilterExpressions ?? [])
  }

  const adminLevels = Array.from(adminLevelSet).sort()
  if (adminLevels.length === 0) {
    throw new Error(
      'Shared admin candidates extract has no admin_level values; at least one area must declare osm.adminLevels',
    )
  }
  const tagsFilterExpressions = Array.from(tagsFilterSet)
    .map((v) => v.trim())
    .filter((v) => v.length > 0)

  return { adminLevels, tagsFilterExpressions }
}
