import type { ComparisonForReport, SnapshotsJson } from '../types/report'
import { comparisonApiUrl, featureApiUrl, snapshotsUrl, unmatchedApiUrl } from './paths'

export async function loadComparison(area: string): Promise<ComparisonForReport> {
  const url = comparisonApiUrl(area)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return r.json() as Promise<ComparisonForReport>
}

export async function loadFeature(area: string, featureKey: string): Promise<ComparisonForReport> {
  const url = featureApiUrl(area, featureKey)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return r.json() as Promise<ComparisonForReport>
}

export async function loadUnmatched(area: string): Promise<ComparisonForReport> {
  const url = unmatchedApiUrl(area)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return r.json() as Promise<ComparisonForReport>
}

export async function loadSnapshots(area: string): Promise<SnapshotsJson | null> {
  const r = await fetch(snapshotsUrl(area))
  if (!r.ok) return null
  return r.json() as Promise<SnapshotsJson>
}
