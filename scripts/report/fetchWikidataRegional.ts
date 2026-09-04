import { padRegional12 } from '../shared/regionalArs.ts'
import type {
  RegionalHubWikidataFile,
  RegionalHubWikidataRow,
} from '../shared/regionalHubPayload.ts'
import { regionalHubWikidataFileSchema } from '../shared/regionalHubPayload.ts'
import {
  WIKIDATA_SPARQL_ENDPOINT,
  WIKIDATA_SPARQL_USER_AGENT,
  allWikidataSparqlQueries,
  splitWikidataSparqlQueries,
} from './wikidataRegionalSparql.ts'

function wikidataQueryHash(query: string): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(query)
  return hasher.digest('hex').slice(0, 16)
}

const SKIP_MS = 7 * 24 * 60 * 60 * 1000
const SPARQL_TIMEOUT_MS = 55_000

type SparqlBinding = Record<string, { type?: string; value?: string } | undefined>

type SparqlJson = {
  results?: { bindings?: SparqlBinding[] }
}

function bindingValue(row: SparqlBinding, key: string): string | undefined {
  const value = row[key]?.value?.trim()
  return value === '' ? undefined : value
}

function compactRow(row: SparqlBinding): { ars12: string; item: RegionalHubWikidataRow } | null {
  const ars12 = padRegional12(bindingValue(row, 'ars') ?? '')
  const qid = bindingValue(row, 'qid')
  if (!ars12 || !qid) return null
  const item: RegionalHubWikidataRow = { qid }
  const ags = bindingValue(row, 'ags')?.replace(/\D/g, '')
  if (ags && ags.length >= 8) item.ags8 = ags.slice(0, 8)
  const popRaw = bindingValue(row, 'pop')
  if (popRaw !== undefined) {
    const pop = Number(popRaw)
    if (Number.isFinite(pop)) item.pop = Math.round(pop)
  }
  const dateRaw = bindingValue(row, 'date')
  if (dateRaw) item.date = dateRaw.slice(0, 10)
  const osm = bindingValue(row, 'osm')
  if (osm) item.osmRelationId = osm.replace(/^relation\//i, '')
  return { ars12, item }
}

function mergeBindings(bindings: SparqlBinding[]): {
  byArs: RegionalHubWikidataFile['byArs']
  duplicateArsCount: number
} {
  const byArs: RegionalHubWikidataFile['byArs'] = {}
  let duplicateArsCount = 0
  for (const binding of bindings) {
    const parsed = compactRow(binding)
    if (!parsed) continue
    if (byArs[parsed.ars12]) {
      duplicateArsCount += 1
      continue
    }
    byArs[parsed.ars12] = parsed.item
  }
  return { byArs, duplicateArsCount }
}

async function postSparql(query: string): Promise<SparqlBinding[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SPARQL_TIMEOUT_MS)
  try {
    const response = await fetch(WIKIDATA_SPARQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Accept-Encoding': 'gzip',
        'Content-Type': 'application/sparql-query',
        'User-Agent': WIKIDATA_SPARQL_USER_AGENT,
      },
      body: query,
      signal: controller.signal,
    })
    if (!response.ok) {
      throw new Error(`WDQS HTTP ${response.status}`)
    }
    const json = (await response.json()) as SparqlJson
    return json.results?.bindings ?? []
  } finally {
    clearTimeout(timer)
  }
}

export function shouldSkipWikidataFetch(
  existing: RegionalHubWikidataFile | null,
  queryHash: string,
  nowMs = Date.now(),
  force = false,
): boolean {
  if (force || !existing?.generatedAt) return false
  if (existing.queryHash !== queryHash) return false
  if (
    existing.skipReason === 'wikidata_last_good_fallback' ||
    existing.skipReason === 'wikidata_fetch_failed'
  ) {
    return false
  }
  const generatedMs = Date.parse(existing.generatedAt)
  if (!Number.isFinite(generatedMs)) return false
  return nowMs - generatedMs < SKIP_MS
}

export async function fetchWikidataRegionalDump(options: {
  existing: RegionalHubWikidataFile | null
  force?: boolean
  now?: Date
}): Promise<RegionalHubWikidataFile> {
  const queryHash = wikidataQueryHash(allWikidataSparqlQueries()[0]!.query)
  const now = options.now ?? new Date()
  if (shouldSkipWikidataFetch(options.existing, queryHash, now.getTime(), options.force === true)) {
    return {
      ...options.existing!,
      skipped: true,
      skipReason: 'wikidata_sidecar_fresh_7d',
    }
  }

  const started = Date.now()
  try {
    const bindings = await postSparql(allWikidataSparqlQueries()[0]!.query)
    const merged = mergeBindings(bindings)
    return regionalHubWikidataFileSchema.parse({
      generatedAt: now.toISOString(),
      queryHash,
      durationMs: Date.now() - started,
      rowCount: Object.keys(merged.byArs).length,
      duplicateArsCount: merged.duplicateArsCount,
      byArs: merged.byArs,
    })
  } catch (error) {
    const splitStarted = Date.now()
    try {
      const byArs: RegionalHubWikidataFile['byArs'] = {}
      let duplicateArsCount = 0
      for (const part of splitWikidataSparqlQueries()) {
        console.log(`[regional-hub] WDQS split ${part.label}`)
        const bindings = await postSparql(part.query)
        const merged = mergeBindings(bindings)
        duplicateArsCount += merged.duplicateArsCount
        Object.assign(byArs, merged.byArs)
      }
      return regionalHubWikidataFileSchema.parse({
        generatedAt: now.toISOString(),
        queryHash,
        durationMs: Date.now() - splitStarted,
        rowCount: Object.keys(byArs).length,
        duplicateArsCount,
        splitByLand: true,
        sparqlError: String(error),
        byArs,
      })
    } catch (splitError) {
      if (options.existing?.byArs) {
        return {
          ...options.existing,
          skipped: true,
          skipReason: 'wikidata_last_good_fallback',
          sparqlError: String(splitError),
        }
      }
      return regionalHubWikidataFileSchema.parse({
        generatedAt: now.toISOString(),
        queryHash,
        durationMs: Date.now() - started,
        rowCount: 0,
        duplicateArsCount: 0,
        byArs: {},
        skipped: true,
        skipReason: 'wikidata_fetch_failed',
        sparqlError: String(splitError),
      })
    }
  }
}

export { compactRow, mergeBindings }
