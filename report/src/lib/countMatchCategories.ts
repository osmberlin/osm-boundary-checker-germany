import type { ReportRow } from '../types/report'

export function countMatchCategories(rows: ReportRow[]) {
  const m = { matched: 0, official_only: 0 }
  for (const r of rows) {
    if (r.category === 'matched') m.matched++
    else if (r.category === 'official_only') m.official_only++
  }
  return m
}
