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
