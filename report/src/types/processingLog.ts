import { z } from 'zod'

const processingLogStatusSchema = z.enum(['ok', 'fail'])
const processingLogStepStatusSchema = z.enum(['ok', 'fail', 'skipped'])

export const processingLogEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('run_start'),
    runId: z.string(),
    at: z.string(),
    timezone: z.string(),
  }),
  z.object({
    kind: z.literal('run_end'),
    runId: z.string(),
    at: z.string(),
    status: processingLogStatusSchema,
    durationMs: z.number(),
  }),
  z.object({
    kind: z.literal('step_start'),
    runId: z.string(),
    at: z.string(),
    step: z.string(),
  }),
  z.object({
    kind: z.literal('step_end'),
    runId: z.string(),
    at: z.string(),
    step: z.string(),
    status: processingLogStepStatusSchema,
    durationMs: z.number(),
    exitCode: z.number(),
    reason: z.string().optional(),
  }),
  z.object({
    kind: z.literal('dataset_start'),
    runId: z.string(),
    at: z.string(),
    dataset: z.string(),
  }),
  z.object({
    kind: z.literal('dataset_end'),
    runId: z.string(),
    at: z.string(),
    dataset: z.string(),
    status: processingLogStatusSchema,
    durationMs: z.number(),
    exitCode: z.number(),
  }),
])

export type LogEvent = z.infer<typeof processingLogEventSchema>

export function parseProcessingLogJsonl(text: string): LogEvent[] {
  const out: LogEvent[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const parsed = processingLogEventSchema.safeParse(JSON.parse(trimmed))
      if (parsed.success) out.push(parsed.data)
    } catch {
      // Ignore malformed lines.
    }
  }
  return out
}
