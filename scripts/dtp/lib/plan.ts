/**
 * Pure planning helpers for the DtP sync: which list items need a detail fetch, which cached records to keep,
 * and which inventory items are managed. No I/O here, so the rules stay testable (see `plan.test.ts`).
 */

import { z } from 'zod'
import {
  DTP_DEFAULT_MAX_DETAILS,
  DTP_DEFAULT_REVERIFY_DAYS,
  DTP_DEFAULT_REVERIFY_MAX,
} from './constants.ts'
import type { DtpCachedRecord, DtpInventoryItem, DtpListItem } from './schemas.ts'

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
  /** uuids to fetch in this run, in priority order (new/changed/backfill first, then re-verify oldest first). */
  uuids: string[]
  /** Every due uuid (new, changed, backfill, or re-verify within `reverifyMax`), including those beyond `maxDetails`. */
  dueCount: number
  /** Breakdown of the due uuids by reason (a uuid counts once, under its first matching reason). */
  reasons: {
    new: number
    updatedAt: number
    areaKm2: number
    organizations: number
    reverify: number
  }
}

/**
 * Drop items with a uuid that was already seen (the list can shift between pages while the sweep runs).
 * The first occurrence wins.
 */
export function dedupeListItems<T extends { uuid: string }>(
  items: T[],
): {
  items: T[]
  duplicateCount: number
} {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    if (seen.has(item.uuid)) continue
    seen.add(item.uuid)
    out.push(item)
  }
  return { items: out, duplicateCount: items.length - out.length }
}

/**
 * Set `managed` on every inventory item.
 * With `managedUuids` (a complete managed sweep) the sweep decides. Otherwise (`null`, the sweep was short or failed)
 * the previous value is kept. An item without a previous value counts as unmanaged and is reported in `unknownCount`.
 * Uuids that only the managed sweep knows are ignored: the main sweep is the inventory.
 */
export function applyManagedFlags(
  items: DtpListItem[],
  managedUuids: ReadonlySet<string> | null,
  previousManaged: ReadonlyMap<string, boolean>,
): { items: DtpInventoryItem[]; managedCount: number; unknownCount: number } {
  let unknownCount = 0
  const out = items.map((item) => {
    let managed: boolean
    if (managedUuids !== null) {
      managed = managedUuids.has(item.uuid)
    } else {
      const previous = previousManaged.get(item.uuid)
      if (previous === undefined) unknownCount++
      managed = previous ?? false
    }
    return { ...item, managed }
  })
  const managedCount = out.filter((item) => item.managed).length
  return { items: out, managedCount, unknownCount }
}

const previousInventorySchema = z.object({
  items: z.array(z.object({ uuid: z.string().min(1), managed: z.boolean().optional() })),
})

/** `uuid` -> `managed` from a previous `inventory.json` (unknown or unreadable JSON gives an empty map). */
export function previousManagedFromInventory(json: unknown): Map<string, boolean> {
  const parsed = previousInventorySchema.safeParse(json)
  const out = new Map<string, boolean>()
  if (!parsed.success) return out
  for (const item of parsed.data.items) {
    if (item.managed !== undefined) out.set(item.uuid, item.managed)
  }
  return out
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
 * Decide which inventory items need a detail fetch in this run.
 *
 * Due when: the uuid is not cached (new), the list `updated_at` differs from `listUpdatedAt`,
 * the list `area_in_km2` differs from `listAreaKm2`, the area is managed and its cached detail has no
 * `responsible_organization_ids` (one-time backfill; unmanaged areas do not need it), or `fetchedAt` is older
 * than `reverifyDays`.
 * Re-verify candidates are capped at `reverifyMax` (oldest `fetchedAt` first), then the total at `maxDetails`.
 */
export function planDetailFetches(
  inventory: DtpInventoryItem[],
  cachedRecords: DtpCachedRecord[],
  now: Date,
  opts: DtpPlanOptions = {},
): DtpDetailPlan {
  const reverifyDays = opts.reverifyDays ?? DTP_DEFAULT_REVERIFY_DAYS
  const reverifyMax = opts.reverifyMax ?? DTP_DEFAULT_REVERIFY_MAX
  const maxDetails = opts.maxDetails ?? DTP_DEFAULT_MAX_DETAILS

  const cachedByUuid = new Map(cachedRecords.map((record) => [record.uuid, record]))
  const reasons = { new: 0, updatedAt: 0, areaKm2: 0, organizations: 0, reverify: 0 }
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
    if (item.managed && cached.detail.responsible_organization_ids === undefined) {
      reasons.organizations++
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
