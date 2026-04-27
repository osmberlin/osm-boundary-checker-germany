import type { ReportRow } from '../types/report'

export function countMatchCategories(rows: ReportRow[]) {
  const m = { matched: 0, official_only: 0 }
  for (const r of rows) {
    switch (r.category) {
      case 'matched':
        m.matched++
        break
      case 'official_only':
        m.official_only++
        break
      case 'unmatched_osm':
        break
    }
  }
  return m
}
