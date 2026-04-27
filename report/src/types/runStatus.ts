import { z } from 'zod'

export const runBranchStatusSchema = z.enum([
  'success',
  'failed_no_cache',
  'compare_failed',
  'skipped',
])

export const runStatusBranchSchema = z.object({
  status: runBranchStatusSchema,
  updatedAt: z.string(),
  usedCache: z.boolean().optional(),
  artifactTimestamp: z.string().optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  retryHint: z.string().optional(),
})

export const runStatusCompareBranchSchema = runStatusBranchSchema.extend({
  compareOutputOrigin: z.enum(['current_run', 'cache_last_good', 'none']).optional(),
  compareOutputGeneratedAt: z.string().optional(),
})

export const runStatusAreaSchema = z.object({
  compare: runStatusCompareBranchSchema.optional(),
  officialDownload: runStatusBranchSchema.optional(),
})

export const runStatusFileSchema = z.object({
  version: z.literal(1),
  runId: z.string(),
  startedAt: z.string(),
  updatedAt: z.string(),
  inProgress: z.boolean(),
  status: z.enum(['ok', 'fail']).optional(),
  shared: z.record(z.string(), runStatusBranchSchema),
  areas: z.record(z.string(), runStatusAreaSchema),
})

export type RunBranchStatus = z.infer<typeof runBranchStatusSchema>
export type RunStatusBranch = z.infer<typeof runStatusBranchSchema>
export type RunStatusCompareBranch = z.infer<typeof runStatusCompareBranchSchema>
export type RunStatusArea = z.infer<typeof runStatusAreaSchema>
export type RunStatusFile = z.infer<typeof runStatusFileSchema>
