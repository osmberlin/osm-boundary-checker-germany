import type { ComparisonForReport, SnapshotsJson } from '../types/report'
import { comparisonTableJson, snapshotsUrl } from './paths'

function utcYyyyMmDdFromGeneratedAt(iso: string): string | null {
  const t = Date.parse(iso.trim())
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString().slice(0, 10)
}

export async function loadComparison(
  area: string,
  snapshot?: string | null,
): Promise<ComparisonForReport> {
  const snap = snapshot && String(snapshot).length > 0 ? String(snapshot) : undefined
  if (!snap) {
    const url = comparisonTableJson(area, snap)
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
    return r.json() as Promise<ComparisonForReport>
  }

  const histUrl = comparisonTableJson(area, snap)
  const histRes = await fetch(histUrl)
  if (histRes.ok) {
    return histRes.json() as Promise<ComparisonForReport>
  }
  if (histRes.status !== 404) {
    throw new Error(`Failed to load ${histUrl}: ${histRes.status}`)
  }

  const latestUrl = comparisonTableJson(area, null)
  const latestRes = await fetch(latestUrl)
  if (!latestRes.ok) {
    throw new Error(
      `Missing historic table (${histUrl}: 404) and latest output (${latestUrl}: ${latestRes.status}).`,
    )
  }
  const latest = (await latestRes.json()) as ComparisonForReport
  const gen = typeof latest.generatedAt === 'string' ? latest.generatedAt : ''
  const genDay = utcYyyyMmDdFromGeneratedAt(gen)
  if (genDay === snap) {
    return latest
  }
  throw new Error(
    `Historic snapshot ${snap} is not available (${histUrl}: 404). Latest table is from ${genDay ?? 'unknown date'}; run compare locally to create history files or copy them into the deploy.`,
  )
}

export async function loadSnapshots(area: string): Promise<SnapshotsJson | null> {
  const r = await fetch(snapshotsUrl(area))
  if (!r.ok) return null
  return r.json() as Promise<SnapshotsJson>
}
