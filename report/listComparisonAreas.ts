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
  displayName: string
  matched: number
  officialOnly: number
  unmatchedOsm: number
}

export type GeoDataSource = {
  name: string
  href?: string
}

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

function sourceDisplayName(part: {
  provider?: unknown
  dataset?: unknown
  layer?: unknown
  sourceUrl?: unknown
}): string | null {
  const provider = typeof part.provider === 'string' ? part.provider.trim() : ''
  const dataset = typeof part.dataset === 'string' ? part.dataset.trim() : ''
  const layer = typeof part.layer === 'string' ? part.layer.trim() : ''
  const sourceUrl = typeof part.sourceUrl === 'string' ? part.sourceUrl.trim() : ''
  if (provider === 'HTTP' && sourceUrl) {
    const httpDisplay = httpSourceDisplayName(sourceUrl, dataset)
    if (httpDisplay) return httpDisplay
  }
  if (provider && dataset && layer) return provider + ' (' + dataset + ', ' + layer + ')'
  if (provider && dataset) return provider + ' (' + dataset + ')'
  if (provider) return provider
  if (dataset) return dataset
  return sourceUrl || null
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
      const parsed = JSON.parse(readFileSync(metadataPath, 'utf-8')) as {
        official?: Record<string, unknown>
        osm?: Record<string, unknown>
      }
      for (const side of [parsed.official, parsed.osm]) {
        if (!side || typeof side !== 'object') continue
        const name = sourceDisplayName(side)
        if (!name) continue
        const href = typeof side.sourceUrl === 'string' ? side.sourceUrl.trim() : ''
        const key = name + '||' + href
        if (!byKey.has(key)) {
          byKey.set(key, href ? { name, href } : { name })
        }
      }
    } catch {
      // ignore malformed metadata for this area
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'de'))
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
      out.push({
        area,
        displayName: areaDisplayName(runtimeRoot, area),
        matched,
        officialOnly,
        unmatchedOsm: unmatched,
      })
    } catch {
      // ignore malformed table file for this area
    }
  }
  return out.sort((a, b) => a.area.localeCompare(b.area))
}
