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

/** Relation id string for Overpass live-tags query, or `null` when not parseable. */
export function overpassRelationTagsInputFromOsmRelationId(raw: string): string | null {
  const parsed = parseReportRowOsmRef(raw)
  if (!parsed) return null
  return String(parsed.numericId)
}
