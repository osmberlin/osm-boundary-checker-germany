import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { OsmDownloadAlertBanner } from '../components/status/OsmDownloadAlertBanner'
import { RunDetailCard } from '../components/status/RunDetailCard'
import { RunTimeline } from '../components/status/RunTimeline'
import { StatusKpiStrip } from '../components/status/StatusKpiStrip'
import {
  osmPipelineStateUrl,
  processingLogJsonlUrl,
  processingStateUrl,
  runStatusUrl,
} from '../data/paths'
import { de } from '../i18n/de'
import { GITHUB_ACTIONS_URL } from '../lib/githubRepo'
import { buildOsmDownloadAlert } from '../lib/osmDownloadStatus'
import {
  buildRunsFromEvents,
  computeStatusKpis,
  parseProcessingLogJsonl,
  partitionRunsByTimeline,
} from '../lib/processingRuns'
import type { ProcessingState } from '../lib/processingStatusTypes'
import { osmPipelineStateSchema, type OsmPipelineState } from '../types/osmPipelineState'
import type { RunStatusFile } from '../types/runStatus'

async function loadProcessingStatusData(): Promise<{
  state: ProcessingState | null
  events: ReturnType<typeof parseProcessingLogJsonl>
  runStatus: RunStatusFile | null
  osmPipelineState: OsmPipelineState | null
}> {
  const [stateRes, logRes, runStatusRes, osmStateRes] = await Promise.all([
    fetch(processingStateUrl(), { cache: 'no-store' }),
    fetch(processingLogJsonlUrl(), { cache: 'no-store' }),
    fetch(runStatusUrl(), { cache: 'no-store' }),
    fetch(osmPipelineStateUrl(), { cache: 'no-store' }),
  ])
  const state = stateRes.ok ? ((await stateRes.json()) as ProcessingState) : null
  const events = logRes.ok ? parseProcessingLogJsonl(await logRes.text()) : []
  const runStatus = runStatusRes.ok ? ((await runStatusRes.json()) as RunStatusFile) : null
  let osmPipelineState: OsmPipelineState | null = null
  if (osmStateRes.ok) {
    const parsed = osmPipelineStateSchema.safeParse(await osmStateRes.json())
    osmPipelineState = parsed.success ? parsed.data : null
  }
  return { state, events, runStatus, osmPipelineState }
}

export function ProcessingStatus() {
  const processingQuery = useQuery({
    queryKey: ['processing-status'],
    queryFn: loadProcessingStatusData,
    refetchInterval: (query) => (query.state.data?.state?.inProgress ? 10_000 : 30_000),
  })
  const state = processingQuery.data?.state ?? null
  const runStatus = processingQuery.data?.runStatus ?? null
  const osmPipelineState = processingQuery.data?.osmPipelineState ?? null
  const error = processingQuery.isError ? String(processingQuery.error) : null
  const runs = buildRunsFromEvents(processingQuery.data?.events ?? [])
  const { inWindow, older, dateKeys } = partitionRunsByTimeline(runs)
  const kpis = computeStatusKpis(runs, state)
  const osmAlert = buildOsmDownloadAlert({
    osmBranch: runStatus?.shared['download:osm'],
    pipelineState: osmPipelineState,
  })

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 text-left sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-100">{de.status.title}</h1>
        <div className="flex shrink-0 items-center gap-4">
          <a
            href={GITHUB_ACTIONS_URL}
            className="text-sm font-medium text-sky-400 underline decoration-sky-400/30 underline-offset-2 hover:decoration-sky-300"
            target="_blank"
            rel="noreferrer"
          >
            {de.status.githubActionsLink}
          </a>
          <Link className="text-sm text-sky-400 underline hover:text-sky-300" to="/">
            {de.status.backHome}
          </Link>
        </div>
      </div>

      <p className="mb-6 max-w-prose text-sm text-pretty text-slate-400">
        {de.status.dataRefreshCadence}
      </p>

      {processingQuery.isLoading ? (
        <p className="text-sm text-slate-400">{de.status.loading}</p>
      ) : null}

      {osmAlert ? <OsmDownloadAlertBanner alert={osmAlert} /> : null}

      <StatusKpiStrip kpis={kpis} />

      <RunTimeline runs={runs} dateKeys={dateKeys} />

      <div className="mt-8 mb-6 rounded border border-slate-700 bg-slate-900 p-4">
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
          {de.status.currentRun}:{' '}
          {state?.runId ? (
            <a className="text-sky-400 underline hover:text-sky-300" href={`#run-${state.runId}`}>
              {state.runId}
            </a>
          ) : (
            '—'
          )}
        </p>
      </div>

      {error ? <p className="mb-4 text-amber-200">{error}</p> : null}

      <section className="mt-8" aria-labelledby="run-details-heading">
        <h2 id="run-details-heading" className="text-lg font-medium text-slate-100">
          {de.status.runDetailsHeading}
        </h2>
        {runs.length === 0 ? (
          <p className="mt-4 text-slate-400">{de.status.noRuns}</p>
        ) : (
          <div className="mt-4 space-y-6">
            {inWindow.map((run) => (
              <RunDetailCard key={run.runId} run={run} runStatus={runStatus} />
            ))}
          </div>
        )}
        {older.length > 0 ? (
          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-medium text-slate-300 hover:text-slate-100">
              {de.status.olderRunsHeading} ({older.length})
            </summary>
            <div className="mt-4 space-y-6">
              {older.map((run) => (
                <RunDetailCard key={run.runId} run={run} runStatus={runStatus} />
              ))}
            </div>
          </details>
        ) : null}
      </section>
    </div>
  )
}
