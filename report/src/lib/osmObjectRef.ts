/** OSM object kind stored in `ReportRow.osmRelationId` (legacy name). */
export type ReportOsmObjectKind = 'relation' | 'way'

export type ParsedReportRowOsmRef = {
  kind: ReportOsmObjectKind
  /** Numeric OSM id (relation or way). */
  numericId: number
}

/**
 * Parse `comparison_table.json` / `ReportRow.osmRelationId`:
 * - numeric string → relation (historic convention)
 * - `way/<digits>` → way
 * - `relation/<digits>` → relation
 */
export function parseReportRowOsmRef(raw: string): ParsedReportRowOsmRef | null {
  const s = raw.trim()
  if (s === '') return null

  const wayMatch = /^way\/(\d+)$/i.exec(s)
  if (wayMatch?.[1]) {
    const numericId = Number(wayMatch[1])
    if (Number.isFinite(numericId) && numericId > 0) return { kind: 'way', numericId }
    return null
  }

  const relMatch = /^relation\/(\d+)$/i.exec(s)
  if (relMatch?.[1]) {
    const numericId = Number(relMatch[1])
    if (Number.isFinite(numericId) && numericId > 0) return { kind: 'relation', numericId }
    return null
  }

  if (/^\d+$/.test(s)) {
    const numericId = Number(s)
    if (Number.isFinite(numericId) && numericId > 0) return { kind: 'relation', numericId }
  }

  return null
}
