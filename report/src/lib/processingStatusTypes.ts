export type ProcessingState = {
  runId?: string
  startedAt?: string
  completedAt?: string
  phase?: string
  inProgress?: boolean
  status?: 'ok' | 'fail'
  timezone?: string
  updatedAt?: string
}
