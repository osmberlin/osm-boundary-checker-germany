/**
 * Pure planning helpers for the DtP sync: which list items need a detail fetch, and which cached records to keep.
 * No I/O here, so the rules stay testable (see `plan.test.ts`).
 */

import {
  DTP_DEFAULT_MAX_DETAILS,
  DTP_DEFAULT_REVERIFY_DAYS,
  DTP_DEFAULT_REVERIFY_MAX,
} from './constants.ts'
import type { DtpCachedRecord, DtpListItem } from './schemas.ts'

const DAY_MS = 24 * 60 * 60 * 1000

export type DtpPlanOptions = {
  /** Re-fetch a detail when its `fetchedAt` is older than this many days. */
  reverifyDays?: number
  /** Upper bound for re-verify fetches per run (oldest `fetchedAt` first). */
  reverifyMax?: number
  /** Upper bound for all detail fetches per run. `Infinity` for `--full`. */
  maxDetails?: number
}

export type DtpDetailPlan = {
  /** uuids to fetch in this run, in priority order (new/changed first, then re-verify oldest first). */
  uuids: string[]
  /** Every due uuid (new, changed, or re-verify within `reverifyMax`), including those beyond `maxDetails`. */
  dueCount: number
  /** Breakdown of the due uuids by reason (a uuid counts once, under its first matching reason). */
  reasons: { new: number; updatedAt: number; areaKm2: number; reverify: number }
}

/**
 * Drop list items with a uuid that was already seen (the list can shift between pages while the sweep runs).
 * The first occurrence wins.
 */
export function dedupeListItems(items: DtpListItem[]): {
  items: DtpListItem[]
  duplicateCount: number
} {
  const seen = new Set<string>()
  const out: DtpListItem[] = []
  for (const item of items) {
    if (seen.has(item.uuid)) continue
    seen.add(item.uuid)
    out.push(item)
  }
  return { items: out, duplicateCount: items.length - out.length }
}

/** Max `updated_at` over the inventory as ISO instant, or `null` for an empty inventory. */
export function maxUpdatedAt(items: DtpListItem[]): string | null {
  let max: string | null = null
  for (const item of items) {
    const ms = Date.parse(item.updated_at)
    if (Number.isNaN(ms)) continue
    if (max === null || ms > Date.parse(max)) max = new Date(ms).toISOString()
  }
  return max
}

/**
 * Keep only cached records whose uuid is still in the inventory.
 * `removedCount` is the number of cached records that were dropped.
 */
export function applyInventory(
  inventory: Pick<DtpListItem, 'uuid'>[],
  cachedRecords: DtpCachedRecord[],
): { kept: DtpCachedRecord[]; removedCount: number } {
  const live = new Set(inventory.map((item) => item.uuid))
  const kept = cachedRecords.filter((record) => live.has(record.uuid))
  return { kept, removedCount: cachedRecords.length - kept.length }
}

/**
 * Decide which list items need a detail fetch in this run.
 *
 * Due when: the uuid is not cached (new), the list `updated_at` differs from `listUpdatedAt`,
 * the list `area_in_km2` differs from `listAreaKm2`, or `fetchedAt` is older than `reverifyDays`.
 * Re-verify candidates are capped at `reverifyMax` (oldest `fetchedAt` first), then the total at `maxDetails`.
 */
export function planDetailFetches(
  inventory: DtpListItem[],
  cachedRecords: DtpCachedRecord[],
  now: Date,
  opts: DtpPlanOptions = {},
): DtpDetailPlan {
  const reverifyDays = opts.reverifyDays ?? DTP_DEFAULT_REVERIFY_DAYS
  const reverifyMax = opts.reverifyMax ?? DTP_DEFAULT_REVERIFY_MAX
  const maxDetails = opts.maxDetails ?? DTP_DEFAULT_MAX_DETAILS

  const cachedByUuid = new Map(cachedRecords.map((record) => [record.uuid, record]))
  const reasons = { new: 0, updatedAt: 0, areaKm2: 0, reverify: 0 }
  const changed: string[] = []
  const reverifyDue: { uuid: string; fetchedMs: number }[] = []
  const reverifyCutoffMs = now.getTime() - reverifyDays * DAY_MS

  for (const item of inventory) {
    const cached = cachedByUuid.get(item.uuid)
    if (!cached) {
      reasons.new++
      changed.push(item.uuid)
      continue
    }
    if (cached.listUpdatedAt !== item.updated_at) {
      reasons.updatedAt++
      changed.push(item.uuid)
      continue
    }
    if (cached.listAreaKm2 !== item.area_in_km2) {
      reasons.areaKm2++
      changed.push(item.uuid)
      continue
    }
    const fetchedMs = Date.parse(cached.fetchedAt)
    // An unreadable fetchedAt counts as due, so the record gets rewritten with a valid timestamp.
    if (Number.isNaN(fetchedMs) || fetchedMs < reverifyCutoffMs) {
      reverifyDue.push({ uuid: item.uuid, fetchedMs: Number.isNaN(fetchedMs) ? 0 : fetchedMs })
    }
  }

  reverifyDue.sort((a, b) => a.fetchedMs - b.fetchedMs)
  const reverifyPicked = reverifyDue.slice(0, reverifyMax).map((entry) => entry.uuid)
  reasons.reverify = reverifyPicked.length

  const due = [...changed, ...reverifyPicked]
  const uuids = due.slice(0, maxDetails)
  return { uuids, dueCount: due.length, reasons }
}
