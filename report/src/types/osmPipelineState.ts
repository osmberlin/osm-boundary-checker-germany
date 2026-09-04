import { z } from 'zod'

export const osmPipelineStateSchema = z.object({
  version: z.literal(1),
  consecutiveFallbackRuns: z.number().int().nonnegative(),
  lastFreshDownloadAt: z.string().optional(),
  lastFallbackAt: z.string().optional(),
  lastFallbackRunId: z.string().optional(),
  lastErrorMessage: z.string().optional(),
  updatedAt: z.string(),
})

export type OsmPipelineState = z.infer<typeof osmPipelineStateSchema>

export const osmDownloadOutcomeSchema = z.enum([
  'fresh',
  'cache_window',
  'fallback_artifact',
  'failed',
])

export const osmDownloadAttemptSchema = z.object({
  attempt: z.enum(['fresh', 'fallback']),
  outcome: osmDownloadOutcomeSchema,
  at: z.string(),
  exitCode: z.number().optional(),
  errorMessage: z.string().optional(),
})

export const osmDownloadAttemptsFileSchema = z.object({
  version: z.literal(1),
  runId: z.string(),
  fresh: osmDownloadAttemptSchema.optional(),
  fallback: osmDownloadAttemptSchema.optional(),
})

export type OsmDownloadOutcome = z.infer<typeof osmDownloadOutcomeSchema>
export type OsmDownloadAttempt = z.infer<typeof osmDownloadAttemptSchema>
export type OsmDownloadAttemptsFile = z.infer<typeof osmDownloadAttemptsFileSchema>
