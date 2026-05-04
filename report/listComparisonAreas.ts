import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { loadAreaConfig } from '../scripts/shared/areaConfig.ts'
import { comparisonForReportSchema } from '../scripts/shared/comparisonPayload.ts'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'
import { resolveOsmProfile } from '../scripts/shared/osmProfiles.ts'
import { sourceMetadataSideSchema } from '../scripts/shared/sourceMetadata.ts'

/** Dataset slugs under `datasets/` that contain `output/comparison_table.json`. */
export function listComparisonAreas(runtimeRoot: string): string[] {
  return listComparisonAreaSummaries(runtimeRoot)
    .map((s) => s.area)
    .sort((a, b) => a.localeCompare(b))
}

const geoDataSourceSchema = z.object({
  name: z.string().min(1),
  href: z.string().optional(),
})
export type GeoDataSource = z.infer<typeof geoDataSourceSchema>

const areaHomeSummarySchema = z.object({
  area: z.string().min(1),
  displayName: z.string().min(1),
  matched: z.number(),
  officialOnly: z.number(),
  unmatchedOsm: z.number(),
  reviews: z.number(),
  issues: z.number(),
  /** From area `config.jsonc` + osmProfile (for report UI; not from comparison_table). */
  osmMatchProperty: z.string().min(1).optional(),
  osmAdminLevels: z.array(z.string().min(1)).optional(),
})
export type AreaHomeSummary = z.infer<typeof areaHomeSummarySchema>

function osmMatchRulesFromAreaConfig(
  workspaceRoot: string,
  area: string,
): { osmMatchProperty?: string; osmAdminLevels?: string[] } {
  try {
    const cfg = loadAreaConfig(workspaceRoot, area)
    const matchProperty = resolveOsmProfile(cfg.osmProfile).matchProperty
    const adminLevels =
      cfg.osm?.adminLevels != null && cfg.osm.adminLevels.length > 0
        ? [...cfg.osm.adminLevels]
        : undefined
    return {
      osmMatchProperty: matchProperty,
      ...(adminLevels ? { osmAdminLevels: adminLevels } : {}),
    }
  } catch {
    return {}
  }
}

const reviewQueueEntrySchema = z.object({
  canonicalMatchKey: z.string().min(1),
  nameLabel: z.string().min(1),
  category: z.enum(['matched', 'official_only']),
})
export type ReviewQueueEntry = z.infer<typeof reviewQueueEntrySchema>

const reviewQueueAreaSchema = z.object({
  area: z.string().min(1),
  displayName: z.string().min(1),
  reviewEntries: z.array(reviewQueueEntrySchema),
  issueEntries: z.array(reviewQueueEntrySchema),
})
export type ReviewQueueArea = z.infer<typeof reviewQueueAreaSchema>

const areaLicenseSummarySchema = z.object({
  area: z.string().min(1),
  displayName: z.string().min(1),
  officialLicenseLabel: z.string().min(1),
  officialLicenseSourceUrl: z.string().optional(),
  officialOsmCompatibility: z.enum(['unknown', 'no', 'yes_licence', 'yes_waiver']),
  officialOsmCompatibilitySourceUrl: z.string().optional(),
  officialOsmCompatibilityComment: z.string().optional(),
})
export type AreaLicenseSummary = z.infer<typeof areaLicenseSummarySchema>

function sourceDisplayName(part: z.infer<typeof sourceMetadataSideSchema>): string | null {
  const provider = part.provider ?? ''
  const dataset = part.dataset ?? ''
  const layer = part.layer ?? ''
  const sourcePublicUrl = part.sourcePublicUrl ?? ''
  const sourceDownloadUrl = part.sourceDownloadUrl ?? ''
  const urlForDisplay = sourcePublicUrl || sourceDownloadUrl
  if (provider === 'HTTP' && urlForDisplay) {
    const httpDisplay = httpSourceDisplayName(urlForDisplay, dataset)
    if (httpDisplay) return httpDisplay
  }
  if (provider && dataset && layer) return provider + ' (' + dataset + ', ' + layer + ')'
  if (provider && dataset) return provider + ' (' + dataset + ')'
  if (provider) return provider
  if (dataset) return dataset
  return urlForDisplay || null
}

function firstSearchParam(u: URL, names: string[]): string {
  for (const name of names) {
    const value = u.searchParams.get(name)
    if (value && value.trim() !== '') return value.trim()
  }
  return ''
}

function inferDatasetHintFromUrl(u: URL): string {
  const typeName = firstSearchParam(u, ['typeNames', 'TYPENAMES', 'typeName', 'TYPENAME'])
  if (typeName) return typeName

  const pathParts = u.pathname.split('/').filter(Boolean)
  const collectionIdx = pathParts.indexOf('collections')
  if (collectionIdx >= 0 && collectionIdx + 1 < pathParts.length) {
    return pathParts[collectionIdx + 1] ?? ''
  }
  const datasetIdx = pathParts.indexOf('datasets')
  if (datasetIdx >= 0 && datasetIdx + 1 < pathParts.length) {
    return pathParts[datasetIdx + 1] ?? ''
  }
  return ''
}

function httpSourceDisplayName(sourceUrl: string, dataset: string): string | null {
  try {
    const u = new URL(sourceUrl)
    const host = u.hostname
    if (!host) return null
    const hint = inferDatasetHintFromUrl(u)
    if (hint) return host + ' (' + hint + ')'
    const datasetIsGeneric = dataset === '' || dataset === 'GeoJSON' || dataset === 'WFS GML'
    if (datasetIsGeneric) return host
    return host + ' (' + dataset + ')'
  } catch {
    return null
  }
}

/** Distinct geodata sources aggregated from area `output/comparison_table.json` payloads. */
export function listGeoDataSources(runtimeRoot: string): GeoDataSource[] {
  const datasetsRoot = join(runtimeRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const byKey = new Map<string, GeoDataSource>()
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const tablePath = join(datasetsRoot, entry.name, 'output', 'comparison_table.json')
    if (!existsSync(tablePath)) continue
    try {
      const parsed = comparisonForReportSchema.parse(
        JSON.parse(readFileSync(tablePath, 'utf-8')) as unknown,
      )
      const side = parsed.sourceMetadata?.official ?? null
      if (!side) continue
      const name = sourceDisplayName(side)
      if (!name) continue
      const hrefPublic = side.sourcePublicUrl ?? ''
      const hrefDownload = side.sourceDownloadUrl ?? ''
      const href = hrefPublic || hrefDownload
      const key = name + '||' + href
      if (!byKey.has(key)) {
        const source: GeoDataSource = href ? { name, href } : { name }
        byKey.set(key, source)
      }
    } catch {
      // ignore malformed metadata for this area
    }
  }
  const sorted = Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'))
  return z.array(geoDataSourceSchema).parse(sorted)
}

/** Per-area official licence summary from `output/comparison_table.json` for homepage rendering. */
export function listAreaLicenseSummaries(runtimeRoot: string): AreaLicenseSummary[] {
  const datasetsRoot = join(runtimeRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: AreaLicenseSummary[] = []
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const area = entry.name
    const tablePath = join(datasetsRoot, area, 'output', 'comparison_table.json')
    if (!existsSync(tablePath)) continue
    let parsedTable: z.infer<typeof comparisonForReportSchema> | null = null
    try {
      parsedTable = comparisonForReportSchema.parse(
        JSON.parse(readFileSync(tablePath, 'utf-8')) as unknown,
      )
    } catch {
      continue
    }
    const official = parsedTable.sourceMetadata?.official ?? null
    const officialLicenseLabelRaw = official?.licenseLabel ?? official?.license ?? ''
    const officialLicenseSourceUrlRaw = official?.licenseSourceUrl ?? ''
    const officialOsmCompatibilityRaw = official?.osmCompatibility ?? 'unknown'
    const officialOsmCompatibilitySourceUrlRaw = official?.osmCompatibilitySourceUrl ?? ''
    const officialOsmCompatibilityCommentRaw = official?.osmCompatibilityComment ?? ''
    const summary: AreaLicenseSummary = {
      area,
      displayName: parsedTable.displayName,
      officialLicenseLabel: officialLicenseLabelRaw || 'unknown',
      ...(officialLicenseSourceUrlRaw
        ? { officialLicenseSourceUrl: officialLicenseSourceUrlRaw }
        : {}),
      officialOsmCompatibility:
        officialOsmCompatibilityRaw === 'no' ||
        officialOsmCompatibilityRaw === 'yes_licence' ||
        officialOsmCompatibilityRaw === 'yes_waiver'
          ? officialOsmCompatibilityRaw
          : 'unknown',
      ...(officialOsmCompatibilitySourceUrlRaw
        ? { officialOsmCompatibilitySourceUrl: officialOsmCompatibilitySourceUrlRaw }
        : {}),
      ...(officialOsmCompatibilityCommentRaw
        ? { officialOsmCompatibilityComment: officialOsmCompatibilityCommentRaw }
        : {}),
    }
    out.push(summary)
  }
  const sorted = out.sort((a, b) => a.area.localeCompare(b.area))
  return z.array(areaLicenseSummarySchema).parse(sorted)
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
      const parsed = comparisonForReportSchema.parse(
        JSON.parse(readFileSync(tablePath, 'utf-8')) as unknown,
      )
      const rows = parsed.rows ?? []
      let matched = 0
      let officialOnly = 0
      let reviews = 0
      let issues = 0
      for (const row of rows) {
        const c = row.category
        if (c === 'matched') matched++
        else if (c === 'official_only') officialOnly++
        const level = row.metrics?.issueIndicator?.level
        if (level === 'review') reviews++
        else if (level === 'issue') issues++
      }
      const unmatched = parsed.unmatchedOsm?.length ?? 0
      const fromConfig = osmMatchRulesFromAreaConfig(runtimeRoot, area)
      const summary: AreaHomeSummary = {
        area,
        displayName: parsed.displayName,
        matched,
        officialOnly,
        unmatchedOsm: unmatched,
        reviews,
        issues,
        ...(fromConfig.osmMatchProperty ? { osmMatchProperty: fromConfig.osmMatchProperty } : {}),
        ...(fromConfig.osmAdminLevels ? { osmAdminLevels: fromConfig.osmAdminLevels } : {}),
      }
      out.push(summary)
    } catch {
      // ignore malformed table file for this area
    }
  }
  const sorted = out.sort((a, b) => a.area.localeCompare(b.area))
  return z.array(areaHomeSummarySchema).parse(sorted)
}

/** Cross-area review queue from all rows with non-ok issue indicator levels. */
export function listReviewQueueByArea(runtimeRoot: string): ReviewQueueArea[] {
  const datasetsRoot = join(runtimeRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: ReviewQueueArea[] = []
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const area = entry.name
    const tablePath = join(datasetsRoot, area, 'output', 'comparison_table.json')
    if (!existsSync(tablePath)) continue
    try {
      const parsed = comparisonForReportSchema.parse(
        JSON.parse(readFileSync(tablePath, 'utf-8')) as unknown,
      )
      const reviewEntries: ReviewQueueEntry[] = []
      const issueEntries: ReviewQueueEntry[] = []
      for (const row of parsed.rows ?? []) {
        const level = row.metrics?.issueIndicator?.level
        if (level !== 'review' && level !== 'issue') continue
        if (row.category !== 'matched' && row.category !== 'official_only') continue
        const entryForQueue: ReviewQueueEntry = {
          canonicalMatchKey: row.canonicalMatchKey,
          nameLabel: row.nameLabel,
          category: row.category,
        }
        if (level === 'issue') issueEntries.push(entryForQueue)
        else reviewEntries.push(entryForQueue)
      }
      if (reviewEntries.length === 0 && issueEntries.length === 0) continue
      reviewEntries.sort((a, b) => a.nameLabel.localeCompare(b.nameLabel, 'de'))
      issueEntries.sort((a, b) => a.nameLabel.localeCompare(b.nameLabel, 'de'))
      out.push({
        area,
        displayName: parsed.displayName,
        reviewEntries,
        issueEntries,
      })
    } catch {
      // ignore malformed table file for this area
    }
  }
  const sorted = out.sort((a, b) => a.area.localeCompare(b.area))
  return z.array(reviewQueueAreaSchema).parse(sorted)
}
