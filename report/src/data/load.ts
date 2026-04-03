import type { ComparisonForReport, SnapshotsJson } from '../types/report'
import { comparisonTableJson, snapshotsUrl } from './paths'

export async function loadComparison(area: string): Promise<ComparisonForReport> {
  const url = comparisonTableJson(area)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return r.json() as Promise<ComparisonForReport>
}

export async function loadSnapshots(area: string): Promise<SnapshotsJson | null> {
  const r = await fetch(snapshotsUrl(area))
  if (!r.ok) return null
  return r.json() as Promise<SnapshotsJson>
}
