import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { textPreview } from '../lib/textPreview'
import type { ComparisonForReport, SnapshotsJson } from '../types/report'
import { comparisonApiUrl, featureApiUrl, snapshotsUrl } from './paths'

const reportMetricsSchema = z.object({
  iou: z.number(),
  areaDiffPct: z.number(),
  symmetricDiffPct: z.number(),
  hausdorffM: z.number(),
  officialAreaM2: z.number(),
  osmAreaM2: z.number(),
})

const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()])

const reportRowSchema = z.object({
  canonicalMatchKey: z.string(),
  nameLabel: z.string(),
  category: z.enum(['matched', 'official_only']),
  osmRelationId: z.string(),
  metrics: reportMetricsSchema.nullable(),
  mapBbox: bboxSchema.nullable(),
  officialForEditPath: z.string().nullable(),
  officialProperties: z.record(z.string(), z.unknown()).nullable(),
  osmProperties: z.record(z.string(), z.unknown()).nullable(),
})

const unmatchedSchema = z.object({
  canonicalMatchKey: z.string(),
  nameLabel: z.string(),
  osmRelationId: z.string(),
  adminLevel: z.string().nullable(),
  mapBbox: bboxSchema.nullable(),
})

const ogcWfsInspectSourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.literal('wfs'),
  baseUrl: z.string(),
  typeName: z.string(),
  wfsVersion: z.enum(['1.1.0', '2.0.0']).optional(),
  bboxAxisOrder: z.enum(['lonlat', 'latlon']).optional(),
  srsName: z.string().optional(),
  outputFormat: z.string().optional(),
  maxFeatures: z.number().optional(),
})

const sourceMetadataSideSchema = z.object({
  downloadedAt: z.string().optional(),
  sourcePublishedAt: z.string().optional(),
  sourceUpdatedAt: z.string().optional(),
  sourceDateSource: z
    .enum([
      'wfs_capabilities',
      'bkg_download_metadata',
      'osm_pbf_header',
      'manual_override',
      'unknown',
    ])
    .optional(),
  provider: z.string().optional(),
  dataset: z.string().optional(),
  layer: z.string().optional(),
  sourceUrl: z.string().optional(),
  note: z.string().optional(),
  license: z.string().optional(),
})

const comparisonForReportSchema = z.object({
  area: z.string(),
  generatedAt: z.string(),
  metricsCrs: z.string(),
  overpassBoundaryTag: z.enum(['administrative', 'postal_code']).optional(),
  hasPmtiles: z.boolean(),
  hasUnmatchedPmtiles: z.boolean().optional(),
  tippecanoeLayer: z.string(),
  sourceMetadata: z
    .object({
      official: sourceMetadataSideSchema.nullable(),
      osm: sourceMetadataSideSchema.nullable(),
    })
    .optional(),
  ogcInspectSources: z.array(ogcWfsInspectSourceSchema).optional(),
  rows: z.array(reportRowSchema),
  unmatchedOsm: z.array(unmatchedSchema),
})

const snapshotsSchema = z.object({
  area: z.string(),
  metricsCrs: z.string(),
  runs: z.array(
    z.object({
      id: z.string(),
      summary: z.object({
        totalRows: z.number(),
        meanIou: z.number(),
        matched: z.number(),
        unmatchedOsm: z.number(),
      }),
    }),
  ),
})

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

export async function loadFeature(area: string, featureKey: string): Promise<ComparisonForReport> {
  const url = featureApiUrl(area, featureKey)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return comparisonForReportSchema.parse(await readJsonStrict(url, r))
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
  try {
    return await loadFeature(area, featureKey)
  } catch (error) {
    const fallback = await loadComparison(area)
    const hasUnmatched = fallback.unmatchedOsm.some((row) => row.canonicalMatchKey === featureKey)
    if (hasUnmatched) return fallback
    throw error
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
