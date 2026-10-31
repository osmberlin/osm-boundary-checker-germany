import type { LiveOsmObjectRef } from './postpass'

export type ParsedReportRowOsmRef = {
  /** Numeric OSM relation id (this product treats matched rows as relations only). */
  numericId: number
}

/**
 * Parse `comparison_table.json` / `ReportRow.osmRelationId` (legacy field name):
 * - numeric string → relation id
 * - `relation/<digits>` → relation id
 *
 * `way/…` is ignored (not used in shipped datasets).
 */
export function parseReportRowOsmRef(raw: string): ParsedReportRowOsmRef | null {
  const s = raw.trim()
  if (s === '') return null

  const relMatch = /^relation\/(\d+)$/i.exec(s)
  if (relMatch?.[1]) {
    const numericId = Number(relMatch[1])
    if (Number.isFinite(numericId) && numericId > 0) return { numericId }
    return null
  }

  if (/^\d+$/.test(s)) {
    const numericId = Number(s)
    if (Number.isFinite(numericId) && numericId > 0) return { numericId }
  }

  return null
}

/**
 * OSM object (`way` or `relation`) of a matched row's `osmRelationId` for a live lookup by id:
 * `way/123`, `relation/123` or a bare relation id. `null` for anything else (`node/…`, empty).
 */
export function parseLiveOsmObjectRef(raw: string): LiveOsmObjectRef | null {
  const way = /^way\/(\d+)$/i.exec(raw.trim())
  if (way?.[1] && Number(way[1]) > 0) return { type: 'way', id: Number(way[1]) }
  const relation = parseReportRowOsmRef(raw)
  return relation ? { type: 'relation', id: relation.numericId } : null
}
