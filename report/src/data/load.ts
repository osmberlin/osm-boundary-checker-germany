import type { ComparisonForReport, SnapshotsJson } from '../types/report'
import { comparisonTableJson, snapshotsUrl } from './paths'

export async function loadComparison(
  area: string,
  snapshot?: string | null,
): Promise<ComparisonForReport> {
  const snap = snapshot && String(snapshot).length > 0 ? String(snapshot) : undefined
  const url = comparisonTableJson(area, snap)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return r.json() as Promise<ComparisonForReport>
}

export async function loadSnapshots(area: string): Promise<SnapshotsJson | null> {
  const r = await fetch(snapshotsUrl(area))
  if (!r.ok) return null
  return r.json() as Promise<SnapshotsJson>
}
