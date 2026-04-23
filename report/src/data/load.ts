import { z } from 'zod'
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

const comparisonForReportSchema = z.object({
  area: z.string(),
  generatedAt: z.string(),
  metricsCrs: z.string(),
  hasPmtiles: z.boolean(),
  hasUnmatchedPmtiles: z.boolean().optional(),
  tippecanoeLayer: z.string(),
  sourceMetadata: z
    .object({
      official: z.record(z.string(), z.unknown()).nullable(),
      osm: z.record(z.string(), z.unknown()).nullable(),
    })
    .optional(),
  ogcInspectSources: z.array(z.record(z.string(), z.unknown())).optional(),
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

export async function loadComparison(area: string): Promise<ComparisonForReport> {
  const url = comparisonApiUrl(area)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return comparisonForReportSchema.parse(await r.json()) as ComparisonForReport
}

export async function loadFeature(area: string, featureKey: string): Promise<ComparisonForReport> {
  const url = featureApiUrl(area, featureKey)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return comparisonForReportSchema.parse(await r.json()) as ComparisonForReport
}

export async function loadSnapshots(area: string): Promise<SnapshotsJson | null> {
  const r = await fetch(snapshotsUrl(area))
  if (!r.ok) return null
  return snapshotsSchema.parse(await r.json()) as SnapshotsJson
}
