import { z } from 'zod'
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

function wikidataQueryHash(query: string) {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(query)
  return hasher.digest('hex').slice(0, 16)
}

const SKIP_MS = 7 * 24 * 60 * 60 * 1000
const SPARQL_TIMEOUT_MS = 55_000

type SparqlBinding = Record<string, { type?: string; value?: string } | undefined>

const wikidataSparqlResultsSchema = z.object({
  results: z.object({
    bindings: z.array(
      z.record(
        z.string(),
        z.object({
          type: z.string().optional(),
          value: z.string().optional(),
        }),
      ),
    ),
  }),
})

function bindingValue(row: SparqlBinding, key: string) {
  const value = row[key]?.value?.trim()
  return value === '' ? undefined : value
}

function compactRow(row: SparqlBinding) {
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

function wikidataRowIsPreferable(next: RegionalHubWikidataRow, prev: RegionalHubWikidataRow) {
  const nextDate = next.date ?? ''
  const prevDate = prev.date ?? ''
  if (nextDate !== prevDate) return nextDate > prevDate
  return next.pop != null && prev.pop == null
}

function mergeBindings(bindings: SparqlBinding[]) {
  const byArs: RegionalHubWikidataFile['byArs'] = {}
  let duplicateArsCount = 0
  for (const binding of bindings) {
    const parsed = compactRow(binding)
    if (!parsed) continue
    const prev = byArs[parsed.ars12]
    if (prev) {
      duplicateArsCount += 1
      if (wikidataRowIsPreferable(parsed.item, prev)) byArs[parsed.ars12] = parsed.item
      continue
    }
    byArs[parsed.ars12] = parsed.item
  }
  return { byArs, duplicateArsCount }
}

async function postSparql(query: string) {
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
    const json = wikidataSparqlResultsSchema.parse(await response.json())
    return json.results.bindings
  } finally {
    clearTimeout(timer)
  }
}

export function shouldSkipWikidataFetch(
  existing: RegionalHubWikidataFile | null,
  queryHash: string,
  nowMs = Date.now(),
  force = false,
) {
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
}) {
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
