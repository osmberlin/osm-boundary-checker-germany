/**
 * Line format of `.cache/dtp/areas.ndjson.gz`: one `DtpCachedRecord` JSON per line, sorted by uuid.
 * Pure string <-> record conversion; gzip and file I/O live in `dtp/download.ts`.
 */

import { dtpCachedRecordSchema, type DtpCachedRecord } from './schemas.ts'

export function parseAreasNdjson(text: string): {
  records: DtpCachedRecord[]
  invalidCount: number
} {
  const records: DtpCachedRecord[] = []
  let invalidCount = 0
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    let json: unknown
    try {
      json = JSON.parse(line)
    } catch {
      invalidCount++
      continue
    }
    const parsed = dtpCachedRecordSchema.safeParse(json)
    if (parsed.success) records.push(parsed.data)
    else invalidCount++
  }
  return { records, invalidCount }
}

export function serializeAreasNdjson(records: DtpCachedRecord[]): string {
  const sorted = [...records].sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0))
  return sorted.map((record) => JSON.stringify(record)).join('\n') + (sorted.length > 0 ? '\n' : '')
}
