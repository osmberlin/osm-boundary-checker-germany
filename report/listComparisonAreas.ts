import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { DATASETS_DIRECTORY } from '../scripts/shared/datasetPaths.ts'

/** Dataset slugs under `datasets/` that contain `output/comparison_table.json`. */
export function listComparisonAreas(runtimeRoot: string): string[] {
  return listComparisonAreaSummaries(runtimeRoot)
    .map((s) => s.area)
    .sort((a, b) => a.localeCompare(b))
}

const trimmedOptionalString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}, z.string().optional())

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
})
export type AreaHomeSummary = z.infer<typeof areaHomeSummarySchema>

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

const sourceMetadataSideSchema = z.object({
  provider: trimmedOptionalString,
  dataset: trimmedOptionalString,
  layer: trimmedOptionalString,
  sourcePublicUrl: trimmedOptionalString,
  sourceDownloadUrl: trimmedOptionalString,
})

const areaMetadataSchema = z.object({
  official: sourceMetadataSideSchema.optional(),
  osm: sourceMetadataSideSchema.optional(),
})

const officialLicenseMetadataSchema = z.object({
  licenseLabel: trimmedOptionalString,
  license: trimmedOptionalString,
  licenseSourceUrl: trimmedOptionalString,
  osmCompatibility: z.enum(['unknown', 'no', 'yes_licence', 'yes_waiver']).optional(),
  osmCompatibilitySourceUrl: trimmedOptionalString,
  osmCompatibilityComment: trimmedOptionalString,
})

const comparisonSummarySchema = z.object({
  rows: z
    .array(
      z.object({
        category: z.enum(['matched', 'official_only']),
      }),
    )
    .optional(),
  unmatchedOsm: z
    .array(
      z.object({
        canonicalMatchKey: z.string(),
        nameLabel: z.string(),
        osmRelationId: z.string(),
        adminLevel: z.string().nullable(),
        mapBbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
      }),
    )
    .optional(),
})

function titleCaseFromSlug(area: string): string {
  const tokenMap: Record<string, string> = {
    de: 'Deutschland',
    plz: 'PLZ',
    laender: 'Länder',
  }
  return area
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => {
      const mapped = tokenMap[part]
      if (mapped) return mapped
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

function areaDisplayName(runtimeRoot: string, area: string): string {
  const fallback = titleCaseFromSlug(area)
  const configPath = join(runtimeRoot, DATASETS_DIRECTORY, area, 'config.jsonc')
  if (!existsSync(configPath)) return fallback
  try {
    const parsed = Bun.JSONC.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>
    const name = typeof parsed.displayName === 'string' ? parsed.displayName.trim() : ''
    return name || fallback
  } catch {
    return fallback
  }
}

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

/** Distinct geodata sources aggregated from area `source/metadata.json` files. */
export function listGeoDataSources(runtimeRoot: string): GeoDataSource[] {
  const datasetsRoot = join(runtimeRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const byKey = new Map<string, GeoDataSource>()
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const metadataPath = join(datasetsRoot, entry.name, 'source', 'metadata.json')
    if (!existsSync(metadataPath)) continue
    try {
      const parsed = areaMetadataSchema.parse(
        JSON.parse(readFileSync(metadataPath, 'utf-8')) as unknown,
      )
      const side = parsed.official
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

/** Per-area official licence summary from `source/metadata.json` for homepage rendering. */
export function listAreaLicenseSummaries(runtimeRoot: string): AreaLicenseSummary[] {
  const datasetsRoot = join(runtimeRoot, DATASETS_DIRECTORY)
  if (!existsSync(datasetsRoot)) return []
  const out: AreaLicenseSummary[] = []
  for (const entry of readdirSync(datasetsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const area = entry.name
    const tablePath = join(datasetsRoot, area, 'output', 'comparison_table.json')
    if (!existsSync(tablePath)) continue
    const metadataPath = join(datasetsRoot, area, 'source', 'metadata.json')
    let official: z.infer<typeof officialLicenseMetadataSchema> = {}
    if (existsSync(metadataPath)) {
      try {
        const parsed = JSON.parse(readFileSync(metadataPath, 'utf-8')) as {
          official?: unknown
        }
        official = officialLicenseMetadataSchema.parse(parsed.official ?? {})
      } catch {
        official = {}
      }
    }
    const officialLicenseLabelRaw = official.licenseLabel ?? official.license ?? ''
    const officialLicenseSourceUrlRaw = official.licenseSourceUrl ?? ''
    const officialOsmCompatibilityRaw = official.osmCompatibility ?? 'unknown'
    const officialOsmCompatibilitySourceUrlRaw = official.osmCompatibilitySourceUrl ?? ''
    const officialOsmCompatibilityCommentRaw = official.osmCompatibilityComment ?? ''
    const summary: AreaLicenseSummary = {
      area,
      displayName: areaDisplayName(runtimeRoot, area),
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
      const parsed = comparisonSummarySchema.parse(
        JSON.parse(readFileSync(tablePath, 'utf-8')) as unknown,
      )
      const rows = parsed.rows ?? []
      let matched = 0
      let officialOnly = 0
      for (const row of rows) {
        const c = row.category
        if (c === 'matched') matched++
        else if (c === 'official_only') officialOnly++
      }
      const unmatched = parsed.unmatchedOsm?.length ?? 0
      const summary: AreaHomeSummary = {
        area,
        displayName: areaDisplayName(runtimeRoot, area),
        matched,
        officialOnly,
        unmatchedOsm: unmatched,
      }
      out.push(summary)
    } catch {
      // ignore malformed table file for this area
    }
  }
  const sorted = out.sort((a, b) => a.area.localeCompare(b.area))
  return z.array(areaHomeSummarySchema).parse(sorted)
}
