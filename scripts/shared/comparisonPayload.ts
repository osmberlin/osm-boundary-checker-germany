import { z } from 'zod'
import { ogcWfsInspectSourceSchema } from './ogcInspectSources.ts'
import { osmSourceMetadataSideSchema, sourceMetadataSideSchema } from './sourceMetadata.ts'

export const reportMetricsSchema = z.object({
  iou: z.number(),
  areaDiffPct: z.number(),
  symmetricDiffPct: z.number(),
  hausdorffM: z.number(),
  officialAreaM2: z.number(),
  osmAreaM2: z.number(),
})

export const bboxSchema = z.tuple([z.number(), z.number(), z.number(), z.number()])

export const reportRowSchema = z.object({
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

export const unmatchedOsmRowSchema = z.object({
  canonicalMatchKey: z.string(),
  nameLabel: z.string(),
  osmRelationId: z.string(),
  adminLevel: z.string().nullable(),
  mapBbox: bboxSchema.nullable(),
})

export const comparisonSourceMetadataEmbeddedSchema = z.object({
  official: sourceMetadataSideSchema.nullable(),
  osm: osmSourceMetadataSideSchema.nullable(),
})

export const comparisonForReportSchema = z.object({
  area: z.string(),
  displayName: z.string().trim().min(1),
  generatedAt: z.string(),
  metricsCrs: z.string(),
  overpassBoundaryTag: z.enum(['administrative', 'postal_code']).optional(),
  hasPmtiles: z.boolean(),
  hasUnmatchedPmtiles: z.boolean().optional(),
  tippecanoeLayer: z.string(),
  sourceMetadata: comparisonSourceMetadataEmbeddedSchema.optional(),
  ogcInspectSources: z.array(ogcWfsInspectSourceSchema).optional(),
  rows: z.array(reportRowSchema),
  unmatchedOsm: z.array(unmatchedOsmRowSchema),
})

export const featureDetailShardSchema = z.object({
  row: reportRowSchema,
})

export const snapshotsSchema = z.object({
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

export type ReportMetrics = z.infer<typeof reportMetricsSchema>
export type ReportRow = z.infer<typeof reportRowSchema>
export type UnmatchedOsmReportRow = z.infer<typeof unmatchedOsmRowSchema>
export type ComparisonForReport = z.infer<typeof comparisonForReportSchema>
export type FeatureDetailShard = z.infer<typeof featureDetailShardSchema>
export type SnapshotsJson = z.infer<typeof snapshotsSchema>
