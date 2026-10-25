#!/usr/bin/env bun
/**
 * Digitize the Planet (DtP) API v2 sync for Germany.
 *
 * 1. Sweep all list pages (`/protected-areas`, no geometry) → `.cache/dtp/inventory.json` (source of truth for uuids).
 * 2. Remove cached details whose uuid is gone; fetch details only where due (new, `updated_at` or `area_in_km2` changed,
 *    or older than `--reverify-days`), capped by `--max-details` (`--full` = no cap).
 * 3. Write `.cache/dtp/areas.ndjson.gz`, reference lists and `download-metadata.json`.
 *
 * Planning rules live in `dtp/lib/plan.ts`; schemas in `dtp/lib/schemas.ts`.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { runtimeRootFromWorkspace } from '../shared/runtimeRoot.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'
import { parseAreasNdjson, serializeAreasNdjson } from './lib/areasCache.ts'
import {
  DTP_API_BASE,
  DTP_AREAS_FILE,
  DTP_CACHE_DIR,
  DTP_CATEGORIES_FILE,
  DTP_COUNTRY_ID_GERMANY,
  DTP_INCLUDE_UNMANAGED,
  DTP_DEFAULT_MAX_DETAILS,
  DTP_DEFAULT_PAUSE_MS,
  DTP_DEFAULT_REVERIFY_DAYS,
  DTP_DEFAULT_REVERIFY_MAX,
  DTP_DELETED_LOOKBACK_DAYS,
  DTP_DETAIL_FIELDS,
  DTP_DOWNLOAD_METADATA,
  DTP_GEOMETRY_SOURCES_FILE,
  DTP_INVENTORY_FILE,
  DTP_LICENSES_FILE,
  DTP_LIST_ORDERING,
  DTP_LIST_ORDERING_DESC,
  DTP_LIST_PAGE_SIZE,
  DTP_PROGRESS_EVERY,
  DTP_REQUEST_RETRIES,
  DTP_USER_AGENT,
} from './lib/constants.ts'
import {
  applyInventory,
  dedupeListItems,
  maxUpdatedAt,
  planDetailFetches,
  type DtpDetailPlan,
} from './lib/plan.ts'
import {
  dtpDeletedPageSchema,
  dtpDetailSchema,
  dtpDownloadMetadataSchema,
  dtpListPageSchema,
  type DtpCachedRecord,
  type DtpDownloadMetadata,
  type DtpListItem,
} from './lib/schemas.ts'

type Args = {
  /** `Infinity` with `--full`. */
  maxDetails: number
  /** Testing: fetch at most this many details (after planning). `null` = no limit. */
  limit: number | null
  reverifyDays: number
  pauseMs: number
}

type RequestLabel = 'list' | 'detail' | 'other'

class DtpHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'DtpHttpError'
    this.status = status
  }
}

const requestStats: Record<RequestLabel, { count: number; totalMs: number }> = {
  list: { count: 0, totalMs: 0 },
  detail: { count: 0, totalMs: 0 },
  other: { count: 0, totalMs: 0 },
}

function usage(): string {
  return [
    'Usage: bun run dtp/download.ts [flags]',
    '  --max-details N      cap detail fetches per run (default 1500)',
    '  --full               no cap on detail fetches',
    '  --limit N            testing: fetch at most N details (after planning)',
    '  --reverify-days N    re-fetch details older than N days (default 28)',
    '  --pause-ms N         pause after each request (default 200)',
  ].join('\n')
}

function readNonNegativeInt(flag: string, value: string | undefined): number {
  const n = value === undefined ? Number.NaN : Number(value)
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${flag} expects a non-negative integer, got "${value ?? ''}"`)
  }
  return n
}

function parseArgs(argv: string[]): Args {
  let maxDetails = DTP_DEFAULT_MAX_DETAILS
  let limit: number | null = null
  let reverifyDays = DTP_DEFAULT_REVERIFY_DAYS
  let pauseMs = DTP_DEFAULT_PAUSE_MS
  let full = false
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--help' || flag === '-h') {
      console.log(usage())
      process.exit(0)
    }
    if (flag === '--full') {
      full = true
      continue
    }
    if (flag === '--max-details') maxDetails = readNonNegativeInt(flag, argv[++i])
    else if (flag === '--limit') limit = readNonNegativeInt(flag, argv[++i])
    else if (flag === '--reverify-days') reverifyDays = readNonNegativeInt(flag, argv[++i])
    else if (flag === '--pause-ms') pauseMs = readNonNegativeInt(flag, argv[++i])
    else throw new Error(`Unknown flag: ${flag ?? ''}\n${usage()}`)
  }
  return { maxDetails: full ? Number.POSITIVE_INFINITY : maxDetails, limit, reverifyDays, pauseMs }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetriableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500
}

function recordRequest(label: RequestLabel, startedMs: number): void {
  requestStats[label].count++
  requestStats[label].totalMs += performance.now() - startedMs
}

/**
 * GET with sequential pause and retries (3 retries, exponential backoff) on 408/429/5xx and network or body errors.
 * Other HTTP errors (e.g. 404, 400) throw `DtpHttpError` immediately.
 */
async function dtpGetJson(
  pathname: string,
  params: Record<string, string | number>,
  label: RequestLabel,
  pauseMs: number,
): Promise<unknown> {
  const url = new URL(`${DTP_API_BASE}${pathname}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))

  for (let attempt = 0; ; attempt++) {
    const started = performance.now()
    let json: unknown
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': DTP_USER_AGENT,
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
        },
      })
      const body = await res.text()
      if (!res.ok) {
        throw new DtpHttpError(
          res.status,
          `HTTP ${res.status} ${res.statusText} for ${url.pathname}${url.search}: ${body.slice(0, 200)}`,
        )
      }
      json = JSON.parse(body) as unknown
    } catch (error) {
      recordRequest(label, started)
      const retriable = error instanceof DtpHttpError ? isRetriableHttpStatus(error.status) : true
      if (!retriable || attempt >= DTP_REQUEST_RETRIES) throw error
      const waitMs = 2000 * 2 ** attempt
      console.warn(
        `Request failed (attempt ${attempt + 1}/${DTP_REQUEST_RETRIES + 1}): ${error instanceof Error ? error.message : String(error)}; retrying in ${waitMs / 1000}s`,
      )
      await sleep(waitMs)
      continue
    }
    recordRequest(label, started)
    await sleep(pauseMs)
    return json
  }
}

function writeFileAtomic(path: string, data: string | Buffer): void {
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, data)
  renameSync(tmp, path)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function readCachedRecords(path: string): DtpCachedRecord[] {
  if (!existsSync(path)) return []
  // A corrupt cache must stop the run: silently starting from empty would re-fetch every area.
  const text = gunzipSync(readFileSync(path)).toString('utf-8')
  const { records, invalidCount } = parseAreasNdjson(text)
  if (invalidCount > 0) {
    console.warn(`Skipped ${invalidCount} invalid line(s) in ${path}`)
  }
  return records
}

function readPriorMetadata(path: string): DtpDownloadMetadata | null {
  if (!existsSync(path)) return null
  try {
    const parsed = dtpDownloadMetadataSchema.safeParse(
      JSON.parse(readFileSync(path, 'utf-8')) as unknown,
    )
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Walk `/protected-areas` in the given order until `next` is null. Raw items, duplicates included. */
async function sweepInventory(
  pauseMs: number,
  ordering: string,
): Promise<{ raw: DtpListItem[]; serverCount: number; pageCount: number }> {
  const raw: DtpListItem[] = []
  let serverCount = 0
  let pageCount = 0
  let expectedPages = 0
  for (let page = 1; ; page++) {
    const json = await dtpGetJson(
      '/protected-areas',
      {
        country_id: DTP_COUNTRY_ID_GERMANY,
        include_unmanaged: String(DTP_INCLUDE_UNMANAGED),
        fields: 'all',
        ordering,
        page,
      },
      'list',
      pauseMs,
    )
    const parsed = dtpListPageSchema.parse(json)
    if (page === 1) {
      serverCount = parsed.count
      expectedPages = Math.ceil(serverCount / DTP_LIST_PAGE_SIZE)
    }
    pageCount++
    raw.push(...parsed.results)
    if (page % 10 === 0) console.log(`list page ${page}/${expectedPages} (ordering ${ordering})`)
    if (parsed.next === null || parsed.results.length === 0) break
    if (pageCount > expectedPages + 5) {
      throw new Error(
        `List sweep exceeded ${expectedPages} expected pages; API paging is inconsistent`,
      )
    }
  }
  return { raw, serverCount, pageCount }
}

async function fetchDeletedCount(
  deletedAfter: string,
  inventoryUuids: Set<string>,
  pauseMs: number,
): Promise<void> {
  const json = await dtpGetJson(
    '/protected-areas/deleted',
    { deleted_after: deletedAfter },
    'other',
    pauseMs,
  )
  const page = dtpDeletedPageSchema.parse(json)
  const stillListed = page.results.filter((item) => inventoryUuids.has(item.uuid)).length
  console.log(
    `Deleted since ${deletedAfter}: ${page.count} (page 1: ${page.results.length} listed, ${stillListed} still in inventory; inventory is the source of truth)`,
  )
  if (stillListed > 0) {
    console.warn(`${stillListed} deleted uuid(s) on page 1 are still in the inventory sweep`)
  }
}

async function fetchReferenceList(
  pathname: string,
  fileName: string,
  cacheDir: string,
  pauseMs: number,
): Promise<void> {
  const json = await dtpGetJson(pathname, {}, 'other', pauseMs)
  if (!Array.isArray(json)) throw new Error(`Expected a JSON array from ${pathname}`)
  writeFileAtomic(join(cacheDir, fileName), `${JSON.stringify(json, null, 2)}\n`)
  console.log(`Wrote ${fileName} (${json.length} entries)`)
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

function logPlan(plan: DtpDetailPlan, toFetchCount: number): void {
  const { new: newCount, updatedAt, areaKm2, reverify } = plan.reasons
  console.log(
    `Detail plan: due ${plan.dueCount} (new ${newCount}, updated_at ${updatedAt}, area_in_km2 ${areaKm2}, re-verify ${reverify}); fetching ${toFetchCount}`,
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const runtimeRoot = runtimeRootFromWorkspace(workspaceRoot)
  const cacheDir = join(runtimeRoot, DTP_CACHE_DIR)
  const areasPath = join(cacheDir, DTP_AREAS_FILE)
  const metadataPath = join(cacheDir, DTP_DOWNLOAD_METADATA)
  mkdirSync(cacheDir, { recursive: true })

  const runStarted = new Date()
  const prior = readPriorMetadata(metadataPath)
  const cachedBefore = readCachedRecords(areasPath)
  console.log(
    `Cache: ${cachedBefore.length} detail record(s) in ${relative(workspaceRoot, areasPath)}`,
  )

  // 1. Inventory sweep (see DTP_LIST_ORDERING for why not the default order). A second, descending sweep
  // runs only when the first one is short; the union of both is the inventory.
  const sweepStarted = Date.now()
  const firstSweep = await sweepInventory(args.pauseMs, DTP_LIST_ORDERING)
  const serverCount = firstSweep.serverCount
  const sweepRaw = [...firstSweep.raw]
  let pageCount = firstSweep.pageCount
  let merged = dedupeListItems(sweepRaw)
  console.log(
    `Sweep ${DTP_LIST_ORDERING}: ${merged.items.length} unique of ${serverCount} (${firstSweep.pageCount} pages)`,
  )
  if (merged.items.length < serverCount) {
    const secondSweep = await sweepInventory(args.pauseMs, DTP_LIST_ORDERING_DESC)
    sweepRaw.push(...secondSweep.raw)
    pageCount += secondSweep.pageCount
    merged = dedupeListItems(sweepRaw)
    console.log(
      `Sweep ${DTP_LIST_ORDERING_DESC}: union now ${merged.items.length} unique of ${serverCount}`,
    )
  }
  const inventory = merged.items
  // Only a complete inventory may prune the cache; a short one would drop areas that are still live.
  const inventoryComplete = inventory.length >= serverCount
  if (!inventoryComplete) {
    console.warn(
      `Inventory incomplete: ${inventory.length} of ${serverCount} area(s) after both sweeps. Cached records are kept, nothing is pruned.`,
    )
  }
  const sweepFinished = new Date()
  writeFileAtomic(
    join(cacheDir, DTP_INVENTORY_FILE),
    `${JSON.stringify(
      {
        fetchedAt: sweepFinished.toISOString(),
        serverCount,
        pageCount,
        duplicateCount: merged.duplicateCount,
        items: inventory,
      },
      null,
      2,
    )}\n`,
  )
  console.log(
    `Inventory: ${inventory.length} unique area(s) from ${pageCount} page(s) in ${formatSeconds(Date.now() - sweepStarted)} (avg list request ${Math.round(requestStats.list.totalMs / Math.max(1, requestStats.list.count))} ms)`,
  )

  // 2. Deleted (log only) and reference lists
  const deletedAfter = prior
    ? isoDate(new Date(prior.downloadedAt))
    : isoDate(new Date(runStarted.getTime() - DTP_DELETED_LOOKBACK_DAYS * 24 * 60 * 60 * 1000))
  try {
    await fetchDeletedCount(deletedAfter, new Set(inventory.map((item) => item.uuid)), args.pauseMs)
  } catch (error) {
    console.warn(
      `Deleted list failed (inventory unaffected): ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  await fetchReferenceList('/licenses', DTP_LICENSES_FILE, cacheDir, args.pauseMs)
  await fetchReferenceList('/geometry-sources', DTP_GEOMETRY_SOURCES_FILE, cacheDir, args.pauseMs)
  await fetchReferenceList(
    '/protected-area-categories',
    DTP_CATEGORIES_FILE,
    cacheDir,
    args.pauseMs,
  )

  // 3. Drop cached details that left the inventory, then plan detail fetches
  const { kept, removedCount } = inventoryComplete
    ? applyInventory(inventory, cachedBefore)
    : { kept: cachedBefore, removedCount: 0 }
  if (removedCount > 0)
    console.log(`Dropped ${removedCount} cached record(s) no longer in the inventory`)
  const plan = planDetailFetches(inventory, kept, runStarted, {
    reverifyDays: args.reverifyDays,
    reverifyMax: DTP_DEFAULT_REVERIFY_MAX,
    maxDetails: args.maxDetails,
  })
  const toFetch = args.limit === null ? plan.uuids : plan.uuids.slice(0, args.limit)
  logPlan(plan, toFetch.length)

  const inventoryByUuid = new Map(inventory.map((item) => [item.uuid, item]))
  const recordsByUuid = new Map(kept.map((record) => [record.uuid, record]))
  const flush = () =>
    writeFileAtomic(
      areasPath,
      gzipSync(Buffer.from(serializeAreasNdjson([...recordsByUuid.values()]), 'utf-8')),
    )

  // 4. Detail fetches (sequential). Partial progress is flushed every DTP_PROGRESS_EVERY fetches and on error.
  let fetched = 0
  let skippedGone = 0
  const detailStarted = Date.now()
  try {
    for (const uuid of toFetch) {
      const item = inventoryByUuid.get(uuid)
      if (!item) continue
      try {
        const json = await dtpGetJson(
          `/protected-areas/${uuid}`,
          { fields: DTP_DETAIL_FIELDS },
          'detail',
          args.pauseMs,
        )
        const detail = dtpDetailSchema.parse(json)
        recordsByUuid.set(uuid, {
          uuid,
          fetchedAt: new Date().toISOString(),
          listUpdatedAt: item.updated_at,
          listAreaKm2: item.area_in_km2,
          detail,
        })
        fetched++
      } catch (error) {
        // Removed between sweep and detail fetch: keep the old cache line, the next sweep decides.
        if (error instanceof DtpHttpError && error.status === 404) {
          skippedGone++
          console.warn(`Detail 404 for ${uuid} (removed after the sweep?)`)
          continue
        }
        throw error
      }
      if (fetched > 0 && fetched % DTP_PROGRESS_EVERY === 0) {
        console.log(
          `Detail progress: ${fetched}/${toFetch.length} (${formatSeconds(Date.now() - detailStarted)}, avg ${Math.round(requestStats.detail.totalMs / Math.max(1, requestStats.detail.count))} ms per request)`,
        )
        flush()
      }
    }
  } finally {
    flush()
  }

  // 5. Metadata
  const sourceUpdatedAt = maxUpdatedAt(inventory)
  if (sourceUpdatedAt === null)
    throw new Error('Inventory is empty; refusing to write download metadata')
  const metadata: DtpDownloadMetadata = {
    sourceUpdatedAt,
    sourceUpdatedAtVerifiedAt: sweepFinished.toISOString(),
    downloadedAt: runStarted.toISOString(),
    inventoryCount: inventory.length,
    cachedCount: recordsByUuid.size,
    pendingDetailCount: plan.dueCount - fetched,
    lastRunFetched: fetched,
  }
  writeFileAtomic(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)

  const areasBytes = existsSync(areasPath) ? readFileSync(areasPath).byteLength : 0
  console.log('--- DtP sync summary ---')
  console.log(
    `Inventory: ${inventory.length} of ${serverCount} (complete ${inventoryComplete}, duplicates across sweeps ${merged.duplicateCount})`,
  )
  console.log(
    `Details: fetched ${fetched} of ${toFetch.length} requested (due ${plan.dueCount}, skipped 404 ${skippedGone}) in ${formatSeconds(Date.now() - detailStarted)}`,
  )
  console.log(
    `Cached: ${recordsByUuid.size} record(s), ${(areasBytes / 1024 / 1024).toFixed(2)} MB gz -> ${relative(workspaceRoot, areasPath)}`,
  )
  console.log(`Pending detail fetches for the next run: ${metadata.pendingDetailCount}`)
  console.log(
    `Requests: list ${requestStats.list.count} (avg ${Math.round(requestStats.list.totalMs / Math.max(1, requestStats.list.count))} ms), detail ${requestStats.detail.count} (avg ${Math.round(requestStats.detail.totalMs / Math.max(1, requestStats.detail.count))} ms), other ${requestStats.other.count}`,
  )
  console.log(
    `Metadata: ${relative(workspaceRoot, metadataPath)} (sourceUpdatedAt ${sourceUpdatedAt})`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error)
  process.exit(1)
})
