import { z } from 'zod'

/** Shape written by `scripts/pipeline/nightly.ts` to `processing-state.json`. */
export const processingStateSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  timezone: z.string(),
  inProgress: z.boolean(),
  phase: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().optional(),
  status: z.enum(['ok', 'fail']).optional(),
})

export type ProcessingState = z.infer<typeof processingStateSchema>
