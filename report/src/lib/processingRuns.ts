import type { ProcessingState } from './processingStatusTypes'
import { berlinCalendarDateKey, berlinTodayDateKey, timelineDateKeys } from './time/calendar'

export type LogEvent =
  | { kind: 'run_start'; runId: string; at: string }
  | { kind: 'run_end'; runId: string; at: string; status: 'ok' | 'fail'; durationMs: number }
  | { kind: 'step_start'; runId: string; at: string; step: string }
  | {
      kind: 'step_end'
      runId: string
      at: string
      step: string
      status: 'ok' | 'fail' | 'skipped'
      durationMs?: number
      reason?: string
    }
  | { kind: 'dataset_start'; runId: string; at: string; dataset: string }
  | {
      kind: 'dataset_end'
      runId: string
      at: string
      dataset: string
      status: 'ok' | 'fail'
      durationMs: number
      exitCode: number
    }

export type RunPhase = 'download' | 'extract' | 'compare' | 'all' | 'unknown'

export type RunView = {
  runId: string
  phase: RunPhase
  startedAt?: string
  endedAt?: string
  durationMs?: number
  status?: 'ok' | 'fail'
  stepSummaries: Array<{
    id: string
    status: 'ok' | 'fail' | 'skipped'
    durationMs?: number
    at: string
    reason?: string
  }>
  datasetSummaries: Array<{
    dataset: string
    status: 'ok' | 'fail'
    durationMs: number
    at: string
  }>
}

export function parseProcessingLogJsonl(text: string): LogEvent[] {
  const out: LogEvent[] = []
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t) continue
    try {
      const parsed = JSON.parse(t) as LogEvent
      if (parsed && typeof parsed === 'object' && 'kind' in parsed) out.push(parsed)
    } catch {
      // Ignore malformed lines.
    }
  }
  return out
}

function isDownloadStep(step: string): boolean {
  return (
    step.startsWith('download:') ||
    step === 'bkg:download' ||
    step === 'osm:download' ||
    step.startsWith('bkg:download')
  )
}

function isExtractStep(step: string): boolean {
  return step.startsWith('extract:') || step === 'bkg:extract' || step.startsWith('osm:extract')
}

function isCompareStep(step: string): boolean {
  return step.startsWith('compare:')
}

export function classifyRunPhase(
  run: Pick<RunView, 'stepSummaries' | 'datasetSummaries'>,
): RunPhase {
  const steps = run.stepSummaries.map((s) => s.id)
  const hasCompareDatasets = run.datasetSummaries.length > 0
  const hasCompareSteps = steps.some(isCompareStep)
  const hasDownload = steps.some(isDownloadStep)
  const hasExtract = steps.some(isExtractStep)

  if (hasCompareDatasets || hasCompareSteps) return 'compare'
  if (hasDownload && hasExtract) return 'all'
  if (hasExtract) return 'extract'
  if (hasDownload) return 'download'
  return 'unknown'
}

export function buildRunsFromEvents(events: LogEvent[]): RunView[] {
  const byRun = new Map<string, RunView>()
  const ensure = (runId: string) => {
    const existing = byRun.get(runId)
    if (existing) return existing
    const created: RunView = { runId, phase: 'unknown', stepSummaries: [], datasetSummaries: [] }
    byRun.set(runId, created)
    return created
  }
  for (const event of events) {
    const run = ensure(event.runId)
    switch (event.kind) {
      case 'run_start':
        run.startedAt = event.at
        break
      case 'run_end':
        run.endedAt = event.at
        run.status = event.status
        run.durationMs = event.durationMs
        break
      case 'step_end':
        run.stepSummaries.push({
          id: event.step,
          status: event.status,
          durationMs: event.durationMs,
          at: event.at,
          reason: event.reason,
        })
        break
      case 'dataset_end':
        run.datasetSummaries.push({
          dataset: event.dataset,
          status: event.status,
          durationMs: event.durationMs,
          at: event.at,
        })
        break
      case 'step_start':
      case 'dataset_start':
        break
    }
  }
  const runs = [...byRun.values()]
  for (const run of runs) {
    run.phase = classifyRunPhase(run)
  }
  return runs.sort((a, b) => String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')))
}

export function runBerlinDayKey(run: RunView): string {
  return berlinCalendarDateKey(run.startedAt ?? run.endedAt ?? '')
}

export function groupRunsByBerlinDay(runs: RunView[]): Map<string, RunView[]> {
  const map = new Map<string, RunView[]>()
  for (const run of runs) {
    const key = runBerlinDayKey(run)
    if (!key) continue
    const list = map.get(key) ?? []
    list.push(run)
    map.set(key, list)
  }
  for (const [, list] of map) {
    list.sort((a, b) => String(a.startedAt ?? '').localeCompare(String(b.startedAt ?? '')))
  }
  return map
}

export function filterRunsInDateKeys(runs: RunView[], dateKeys: string[]): RunView[] {
  const set = new Set(dateKeys)
  return runs.filter((r) => set.has(runBerlinDayKey(r)))
}

export function partitionRunsByTimeline(
  runs: RunView[],
  centerKey: string = berlinTodayDateKey(),
): { inWindow: RunView[]; older: RunView[]; dateKeys: string[] } {
  const dateKeys = timelineDateKeys(centerKey)
  const inWindow = filterRunsInDateKeys(runs, dateKeys)
  const inSet = new Set(inWindow.map((r) => r.runId))
  const older = runs.filter((r) => !inSet.has(r.runId))
  return { inWindow, older, dateKeys }
}

export function fmtDurationMs(v?: number): string {
  if (v == null) return '—'
  if (v < 60_000) return `${(v / 1000).toFixed(1)} s`
  const min = Math.floor(v / 60_000)
  const sec = Math.round((v % 60_000) / 1000)
  return sec > 0 ? `${min} min ${sec} s` : `${min} min`
}

export function fmtStepReason(status: 'ok' | 'fail' | 'skipped', reason?: string): string {
  if (!reason) return ''
  if (status === 'skipped') return ` (${reason})`
  return ` (${reason})`
}

export function runAnchorId(runId: string): string {
  return `run-${runId}`
}

export type StatusKpis = {
  lastCompareOkAt?: string
  lastDownloadOkAt?: string
  lastPublishedAt?: string
}

export function computeStatusKpis(runs: RunView[], state: ProcessingState | null): StatusKpis {
  let lastCompareOkAt: string | undefined
  let lastDownloadOkAt: string | undefined
  let lastPublishedAt: string | undefined

  for (const run of runs) {
    if (run.status !== 'ok') continue
    const end = run.endedAt ?? run.startedAt
    if (!end) continue
    if (run.phase === 'compare' && !lastCompareOkAt) lastCompareOkAt = end
    if (run.phase === 'download' && !lastDownloadOkAt) lastDownloadOkAt = end
  }

  for (const run of runs) {
    for (const d of run.datasetSummaries) {
      if (d.status === 'ok' && d.at) {
        if (!lastPublishedAt || d.at > lastPublishedAt) lastPublishedAt = d.at
      }
    }
  }

  if (!state?.inProgress && state?.completedAt) {
    if (!lastPublishedAt || state.completedAt > lastPublishedAt) {
      lastPublishedAt = state.completedAt
    }
  }

  return { lastCompareOkAt, lastDownloadOkAt, lastPublishedAt }
}
