import { de } from '../../i18n/de'
import { formatDeInteger } from '../../lib/formatDe'
import {
  fmtDurationMs,
  fmtStepReason,
  runAnchorId,
  type RunPhase,
  type RunView,
} from '../../lib/processingRuns'
import { StatusDateTime } from '../../lib/statusDateTime'
import type { RunStatusFile } from '../../types/runStatus'
import { DetailBox, DetailRow, statusBadgeClasses } from './DetailLayout'
import { RunStatusBranches } from './RunStatusBranches'

function phaseLabel(phase: RunPhase): string {
  switch (phase) {
    case 'download':
      return de.status.phaseDownload
    case 'extract':
      return de.status.phaseExtract
    case 'compare':
      return de.status.phaseCompare
    case 'all':
      return de.status.phaseAll
    default:
      return de.status.phaseUnknown
  }
}

function phaseBadgeClass(phase: RunPhase): string {
  switch (phase) {
    case 'download':
      return 'bg-sky-900/60 text-sky-100'
    case 'extract':
      return 'bg-amber-900/60 text-amber-100'
    case 'compare':
      return 'bg-violet-900/60 text-violet-100'
    default:
      return 'bg-slate-700 text-slate-200'
  }
}

export function RunDetailCard({
  run,
  runStatus,
}: {
  run: RunView
  runStatus: RunStatusFile | null
}) {
  const ok = run.status === 'ok'
  const datasetsOk = run.datasetSummaries.filter((d) => d.status === 'ok').length
  const datasetsFail = run.datasetSummaries.filter((d) => d.status === 'fail').length
  const showBranches = runStatus != null && runStatus.runId === run.runId

  return (
    <div className="space-y-4">
      <DetailBox
        id={runAnchorId(run.runId)}
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${phaseBadgeClass(run.phase)}`}
            >
              {phaseLabel(run.phase)}
            </span>
            <code className="text-sm font-normal text-slate-400">{run.runId}</code>
          </span>
        }
        headerRight={
          run.status != null ? (
            <span className={statusBadgeClasses(ok)}>
              {ok ? de.status.statusOk : de.status.statusFail}
            </span>
          ) : null
        }
      >
        <DetailRow label={de.status.started}>
          {run.startedAt ? <StatusDateTime value={run.startedAt} /> : '—'}
        </DetailRow>
        <DetailRow label={de.status.ended}>
          {run.endedAt ? <StatusDateTime value={run.endedAt} /> : '—'}
        </DetailRow>
        <DetailRow label={de.status.duration}>{fmtDurationMs(run.durationMs)}</DetailRow>
        {run.stepSummaries.length > 0 ? (
          <DetailRow
            label={`${de.status.downloadAndSteps} (${formatDeInteger(run.stepSummaries.length)})`}
          >
            <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-xs text-slate-400">
              {run.stepSummaries.map((s) => (
                <li key={`${run.runId}-${s.id}`}>
                  {s.id} — {s.status}
                  {s.status === 'skipped' ? ` (${de.status.statusSkipped})` : ''} —{' '}
                  {fmtDurationMs(s.durationMs)}
                  {fmtStepReason(s.status, s.reason)}
                </li>
              ))}
            </ul>
          </DetailRow>
        ) : null}
        {run.datasetSummaries.length > 0 ? (
          <DetailRow
            label={`${de.status.datasets} (${formatDeInteger(run.datasetSummaries.length)})`}
          >
            <p className="mb-2 text-xs text-slate-500">
              {de.status.datasetsOkFail
                .replace('{ok}', formatDeInteger(datasetsOk))
                .replace('{fail}', formatDeInteger(datasetsFail))}
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto font-mono text-xs text-slate-400">
              {run.datasetSummaries.map((d) => (
                <li key={`${run.runId}-${d.dataset}`}>
                  {d.dataset} — {d.status} — {fmtDurationMs(d.durationMs)}
                </li>
              ))}
            </ul>
          </DetailRow>
        ) : null}
      </DetailBox>
      {showBranches ? <RunStatusBranches runStatus={runStatus} /> : null}
    </div>
  )
}
