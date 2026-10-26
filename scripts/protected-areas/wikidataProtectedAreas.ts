import {
  bindingValue,
  postSparql,
  wikidataQueryHash,
  type SparqlBinding,
} from '../report/fetchWikidataRegional.ts'
import {
  wikidataProtectedAreasFileSchema,
  type WikidataProtectedAreaItem,
  type WikidataProtectedAreasFile,
} from '../shared/wikidataProtectedAreasPayload.ts'
import {
  wikidataProtectedAreasSparql,
  wikidataProtectedAreasSparqlForQids,
} from '../shared/wikidataProtectedAreasQuery.ts'

const SKIP_MS = 7 * 24 * 60 * 60 * 1000
/** Ids per `VALUES` query. */
const QID_BATCH_SIZE = 400
/** WDPA ids are numeric; the split fallback runs one query per leading digit. */
const WDPA_PREFIXES = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
const QID_PATTERN = /^Q[1-9]\d*$/

export function protectedAreasQueryHash() {
  return wikidataQueryHash(wikidataProtectedAreasSparql())
}

function pushUnique(list: string[] | undefined, value: string | undefined) {
  if (value === undefined) return list
  if (!list) return [value]
  if (!list.includes(value)) list.push(value)
  return list
}

/** Folds the rows of one item (an item repeats once per combination of optional values) into one record. */
export function mergeBindings(bindings: SparqlBinding[]) {
  const byQid: Record<string, WikidataProtectedAreaItem> = {}
  for (const row of bindings) {
    const qid = bindingValue(row, 'qid')
    if (!qid || !QID_PATTERN.test(qid)) continue
    const item = (byQid[qid] ??= {})
    const label = bindingValue(row, 'label')
    if (label && !QID_PATTERN.test(label) && item.label === undefined) item.label = label
    const wdpa = pushUnique(item.wdpa, bindingValue(row, 'wdpa'))
    if (wdpa) item.wdpa = wdpa
    const osm = bindingValue(row, 'osm')?.replace(/^relation\//i, '')
    const osmRelation = pushUnique(item.osmRelation, osm)
    if (osmRelation) item.osmRelation = osmRelation
    const website = pushUnique(item.website, bindingValue(row, 'website'))
    if (website) item.website = website
    const operatorQid = bindingValue(row, 'operatorQid')
    if (operatorQid) {
      const rawLabel = bindingValue(row, 'operatorLabel')
      const operatorLabel = rawLabel && !QID_PATTERN.test(rawLabel) ? rawLabel : undefined
      const operators = (item.operator ??= [])
      const known = operators.find((operator) => operator.qid === operatorQid)
      if (!known) {
        operators.push({ qid: operatorQid, ...(operatorLabel ? { label: operatorLabel } : {}) })
      } else if (known.label === undefined && operatorLabel) {
        known.label = operatorLabel
      }
    }
    // m² -> ha with two decimals; several best-rank statements: keep the largest.
    const areaHa = Math.round(Number(bindingValue(row, 'area')) / 100) / 100
    if (Number.isFinite(areaHa) && areaHa > 0 && areaHa > (item.areaHa ?? 0)) item.areaHa = areaHa
    const commons = bindingValue(row, 'commons')
    if (commons && item.commons === undefined) item.commons = commons
  }
  return byQid
}

export function shouldReuseDump(
  existing: WikidataProtectedAreasFile | null,
  queryHash: string,
  nowMs = Date.now(),
  force = false,
) {
  if (force || !existing) return false
  if (existing.queryHash !== queryHash) return false
  if (existing.skipReason !== undefined) return false
  const fetchedMs = Date.parse(existing.fetchedAt)
  return Number.isFinite(fetchedMs) && nowMs - fetchedMs < SKIP_MS
}

export function missingQids(referenced: Iterable<string>, byQid: Record<string, unknown>) {
  const missing = new Set<string>()
  for (const qid of referenced) {
    if (QID_PATTERN.test(qid) && !(qid in byQid)) missing.add(qid)
  }
  return [...missing].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
}

async function fetchBase() {
  try {
    return { byQid: mergeBindings(await postSparql(wikidataProtectedAreasSparql())) }
  } catch (error) {
    console.log(`[wikidata] main query failed (${String(error)}), splitting by WDPA digit`)
    const byQid: Record<string, WikidataProtectedAreaItem> = {}
    for (const prefix of WDPA_PREFIXES) {
      console.log(`[wikidata] WDQS split wdpa-${prefix}`)
      Object.assign(byQid, mergeBindings(await postSparql(wikidataProtectedAreasSparql(prefix))))
    }
    return { byQid, split: true, sparqlError: String(error) }
  }
}

async function fetchReferenced(qids: readonly string[]) {
  const byQid: Record<string, WikidataProtectedAreaItem> = {}
  for (let i = 0; i < qids.length; i += QID_BATCH_SIZE) {
    const batch = qids.slice(i, i + QID_BATCH_SIZE)
    Object.assign(
      byQid,
      mergeBindings(await postSparql(wikidataProtectedAreasSparqlForQids(batch))),
    )
  }
  return byQid
}

/**
 * The dump to write, or `null` when nothing could be fetched and there is no earlier dump (the
 * caller then keeps whatever file is there). A fresh earlier dump (< 7 days, same query) is reused;
 * referenced ids it lacks are still fetched by id. When the main query fails the earlier dump stays.
 */
export async function fetchWikidataProtectedAreas(options: {
  existing: WikidataProtectedAreasFile | null
  /** Item ids DtP or OSM reference; fetched by id when the main query does not return them. */
  referencedQids: Iterable<string>
  force?: boolean
  now?: Date
}): Promise<WikidataProtectedAreasFile | null> {
  const now = options.now ?? new Date()
  const queryHash = protectedAreasQueryHash()
  const started = Date.now()
  const referenced = [...options.referencedQids]

  let base: Record<string, WikidataProtectedAreaItem>
  let fetchedAt = now.toISOString()
  let durationMs = 0
  let referencedBefore = 0
  let extras: Pick<WikidataProtectedAreasFile, 'splitByWdpaDigit' | 'sparqlError'> = {}
  if (
    options.existing &&
    shouldReuseDump(options.existing, queryHash, now.getTime(), options.force)
  ) {
    base = options.existing.byQid
    fetchedAt = options.existing.fetchedAt
    durationMs = options.existing.durationMs
    referencedBefore = options.existing.referencedCount
  } else {
    try {
      const fetched = await fetchBase()
      base = fetched.byQid
      durationMs = Date.now() - started
      if (fetched.split) extras = { splitByWdpaDigit: true, sparqlError: fetched.sparqlError }
    } catch (error) {
      console.warn(`[wikidata] fetch failed: ${String(error)}`)
      if (!options.existing) return null
      return {
        ...options.existing,
        skipped: true,
        skipReason: 'wikidata_last_good_fallback',
        sparqlError: String(error),
      }
    }
  }

  const missing = missingQids(referenced, base)
  const byQid = { ...base }
  let referencedCount = 0
  let referencedError: string | undefined
  if (missing.length > 0) {
    try {
      const added = await fetchReferenced(missing)
      Object.assign(byQid, added)
      referencedCount = Object.keys(added).length
    } catch (error) {
      referencedError = String(error)
      console.warn(`[wikidata] fetching referenced items failed: ${referencedError}`)
    }
  }

  return wikidataProtectedAreasFileSchema.parse({
    fetchedAt,
    queryHash,
    durationMs,
    itemCount: Object.keys(byQid).length,
    referencedCount: referencedBefore + referencedCount,
    ...extras,
    ...(referencedError && !extras.sparqlError ? { sparqlError: referencedError } : {}),
    byQid,
  })
}
