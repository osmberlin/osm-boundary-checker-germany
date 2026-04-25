import { queryOptions } from '@tanstack/react-query'
import {
  comparisonForReportSchema,
  featureDetailShardSchema,
  snapshotsSchema,
} from '../../../scripts/shared/comparisonPayload.ts'
import { textPreview } from '../lib/textPreview'
import type { ComparisonForReport, FeatureDetailShard, SnapshotsJson } from '../types/report'
import { comparisonApiUrl, featureApiUrl, snapshotsUrl } from './paths'

async function readJsonStrict(url: string, response: Response): Promise<unknown> {
  const bodyText = await response.text()
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if (!contentType.includes('application/json')) {
    const preview = textPreview(bodyText)
    throw new Error(
      `Expected JSON from ${url}, got content-type "${contentType || 'unknown'}" (starts with: ${JSON.stringify(
        preview,
      )}). Run compare and sync static runtime assets before dev.`,
    )
  }
  try {
    return JSON.parse(bodyText) as unknown
  } catch (error) {
    const preview = textPreview(bodyText)
    throw new Error(
      `Invalid JSON from ${url} (starts with: ${JSON.stringify(preview)}): ${String(error)}`,
    )
  }
}

export async function loadComparison(area: string): Promise<ComparisonForReport> {
  const url = comparisonApiUrl(area)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return comparisonForReportSchema.parse(await readJsonStrict(url, r))
}

export async function loadFeatureShard(
  area: string,
  featureKey: string,
): Promise<FeatureDetailShard> {
  const url = featureApiUrl(area, featureKey)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return featureDetailShardSchema.parse(await readJsonStrict(url, r))
}

export async function loadSnapshots(area: string): Promise<SnapshotsJson | null> {
  const url = snapshotsUrl(area)
  const r = await fetch(url)
  if (!r.ok) return null
  return snapshotsSchema.parse(await readJsonStrict(url, r))
}

export async function loadFeatureOrFallback(
  area: string,
  featureKey: string,
): Promise<ComparisonForReport> {
  const comparison = await loadComparison(area)
  try {
    const shard = await loadFeatureShard(area, featureKey)
    return {
      ...comparison,
      rows: [shard.row],
      unmatchedOsm: [],
    }
  } catch (shardError) {
    const matchedRow = comparison.rows.find((row) => row.canonicalMatchKey === featureKey)
    if (matchedRow) {
      return {
        ...comparison,
        rows: [matchedRow],
        unmatchedOsm: [],
      }
    }
    const hasUnmatched = comparison.unmatchedOsm.some((row) => row.canonicalMatchKey === featureKey)
    if (hasUnmatched) return comparison
    throw shardError
  }
}

export function comparisonQueryOptions(area: string) {
  return queryOptions({
    queryKey: ['comparison', area],
    queryFn: () => loadComparison(area),
  })
}

export function snapshotsQueryOptions(area: string) {
  return queryOptions({
    queryKey: ['snapshots', area],
    queryFn: () => loadSnapshots(area),
  })
}

export function featureQueryOptions(area: string, featureKey: string) {
  return queryOptions({
    queryKey: ['feature', area, featureKey],
    queryFn: () => loadFeatureOrFallback(area, featureKey),
  })
}
