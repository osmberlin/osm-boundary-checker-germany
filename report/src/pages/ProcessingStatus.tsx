import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { processingLogJsonlUrl, processingStateUrl } from '../data/paths'
import { de } from '../i18n/de'
import { formatDeInteger } from '../lib/formatDe'

type ProcessingState = {
  runId?: string
  startedAt?: string
  completedAt?: string
  phase?: string
  inProgress?: boolean
  status?: 'ok' | 'fail'
}

type LogEvent =
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

type RunView = {
  runId: string
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

function fmtDate(v?: string): string {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('de-DE')
}

function fmtMs(v?: number): string {
  if (v == null) return '—'
  return `${(v / 1000).toFixed(1)} s`
}

function parseJsonl(text: string): LogEvent[] {
  const out: LogEvent[] = []
  const lines = text.split('\n')
  for (const line of lines) {
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

function buildRuns(events: LogEvent[]): RunView[] {
  const byRun = new Map<string, RunView>()
  const ensure = (runId: string) => {
    const existing = byRun.get(runId)
    if (existing) return existing
    const created: RunView = { runId, stepSummaries: [], datasetSummaries: [] }
    byRun.set(runId, created)
    return created
  }
  for (const event of events) {
    const run = ensure(event.runId)
    if (event.kind === 'run_start') {
      run.startedAt = event.at
      continue
    }
    if (event.kind === 'run_end') {
      run.endedAt = event.at
      run.status = event.status
      run.durationMs = event.durationMs
      continue
    }
    if (event.kind === 'step_end') {
      run.stepSummaries.push({
        id: event.step,
        status: event.status,
        durationMs: event.durationMs,
        at: event.at,
        reason: event.reason,
      })
      continue
    }
    if (event.kind === 'dataset_end') {
      run.datasetSummaries.push({
        dataset: event.dataset,
        status: event.status,
        durationMs: event.durationMs,
        at: event.at,
      })
    }
  }
  return [...byRun.values()].sort((a, b) =>
    String(b.startedAt ?? '').localeCompare(String(a.startedAt ?? '')),
  )
}

export function ProcessingStatus() {
  const [state, setState] = useState<ProcessingState | null>(null)
  const [events, setEvents] = useState<LogEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [stateRes, logRes] = await Promise.all([
          fetch(processingStateUrl, { cache: 'no-store' }),
          fetch(processingLogJsonlUrl, { cache: 'no-store' }),
        ])
        if (!cancelled) {
          if (stateRes.ok) {
            setState((await stateRes.json()) as ProcessingState)
          } else {
            setState(null)
          }
          if (logRes.ok) {
            const text = await logRes.text()
            setEvents(parseJsonl(text))
          } else {
            setEvents([])
          }
          setError(null)
        }
      } catch (e) {
        if (!cancelled) setError(String(e))
      }
    }
    void load()
    const timer = setInterval(load, state?.inProgress ? 10_000 : 30_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [state?.inProgress])

  const runs = useMemo(() => buildRuns(events), [events])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-left sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-100">{de.status.title}</h1>
        <Link className="text-sky-400 underline hover:text-sky-300" to="/">
          {de.status.backHome}
        </Link>
      </div>

      <div className="mb-6 rounded border border-slate-700 bg-slate-900 p-4">
        <p className="text-sm text-slate-300">
          {de.status.inProgressLabel}:{' '}
          <span className={state?.inProgress ? 'text-emerald-400' : 'text-slate-200'}>
            {state?.inProgress ? de.status.inProgressYes : de.status.inProgressNo}
          </span>
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {de.status.currentPhase}: {state?.phase ?? '—'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {de.status.currentRun}: {state?.runId ?? '—'}
        </p>
      </div>

      {error ? <p className="mb-4 text-amber-200">{error}</p> : null}

      {runs.length === 0 ? (
        <p className="text-slate-400">{de.status.noRuns}</p>
      ) : (
        <ul className="space-y-4">
          {runs.map((run) => (
            <li key={run.runId} className="rounded border border-slate-700 bg-slate-900 p-4">
              <p className="text-sm text-slate-400">
                {de.status.runId}: <code className="rounded bg-slate-800 px-1">{run.runId}</code>
              </p>
              <p className="mt-1 text-sm text-slate-300">
                {de.status.started}: {fmtDate(run.startedAt)} | {de.status.ended}:{' '}
                {fmtDate(run.endedAt)} | {de.status.duration}: {fmtMs(run.durationMs)} |{' '}
                {de.status.result}:{' '}
                <span className={run.status === 'fail' ? 'text-red-300' : 'text-emerald-400'}>
                  {run.status ?? '—'}
                </span>
              </p>

              <div className="mt-3">
                <p className="mb-2 text-sm font-medium text-slate-200">
                  {de.status.downloadAndSteps} ({formatDeInteger(run.stepSummaries.length)})
                </p>
                <ul className="space-y-1 text-sm text-slate-400">
                  {run.stepSummaries.map((s) => (
                    <li key={`${run.runId}-step-${s.id}`}>
                      {s.id} — {s.status} — {fmtMs(s.durationMs)}
                      {s.reason ? ` (${s.reason})` : ''}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-3">
                <p className="mb-2 text-sm font-medium text-slate-200">
                  {de.status.datasets} ({formatDeInteger(run.datasetSummaries.length)})
                </p>
                <ul className="space-y-1 text-sm text-slate-400">
                  {run.datasetSummaries.map((d) => (
                    <li key={`${run.runId}-dataset-${d.dataset}`}>
                      {d.dataset} — {d.status} — {fmtMs(d.durationMs)}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
