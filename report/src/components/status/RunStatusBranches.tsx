import { de } from '../../i18n/de'
import { formatDeInteger } from '../../lib/formatDe'
import { StatusDateTime } from '../../lib/statusDateTime'
import type { RunStatusFile } from '../../types/runStatus'
import { DetailBox, DetailRow } from './DetailLayout'

function originLabel(origin?: string): string {
  if (origin === 'current_run') return de.status.compareOriginCurrent
  if (origin === 'cache_last_good') return de.status.compareOriginCache
  if (origin === 'none') return de.status.compareOriginNone
  return origin ?? '—'
}

function sourceOriginLabel(origin?: string): string {
  switch (origin) {
    case 'fresh':
      return de.status.osmSourceOriginFresh
    case 'cache_window':
      return de.status.osmSourceOriginCacheWindow
    case 'fallback_artifact':
      return de.status.osmSourceOriginFallback
    default:
      return origin ?? '—'
  }
}

export function RunStatusBranches({ runStatus }: { runStatus: RunStatusFile }) {
  const sharedEntries = Object.entries(runStatus.shared).sort(([a], [b]) => a.localeCompare(b))
  const areaEntries = Object.entries(runStatus.areas).sort(([a], [b]) => a.localeCompare(b))

  return (
    <DetailBox title={de.status.runStatusBranchesHeading}>
      <DetailRow label={de.status.runId}>
        <code className="rounded bg-slate-800 px-1 text-xs">{runStatus.runId}</code>
      </DetailRow>
      <DetailRow label={de.status.result}>
        {runStatus.status ?? (runStatus.inProgress ? '…' : '—')}
      </DetailRow>
      <DetailRow label={de.status.runStatusShared}>
        <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
          {sharedEntries.length === 0 ? (
            <li className="text-slate-500">—</li>
          ) : (
            sharedEntries.map(([key, branch]) => (
              <li key={key}>
                <span className="font-mono text-slate-200">{key}</span> — {branch.status}
                {branch.usedCache ? ' (Cache)' : ''}
                {branch.sourceOrigin ? (
                  <>
                    {' '}
                    · {de.status.branchSourceOrigin}: {sourceOriginLabel(branch.sourceOrigin)}
                  </>
                ) : null}
                {branch.errorMessage ? (
                  <div className="mt-0.5 text-amber-300/90">
                    {de.status.branchError}: {branch.errorMessage}
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </DetailRow>
      <DetailRow label={`${de.status.runStatusAreas} (${formatDeInteger(areaEntries.length)})`}>
        <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
          {areaEntries.map(([areaId, area]) => (
            <li key={areaId} className="border-b border-slate-800 pb-2 last:border-0">
              <span className="font-mono font-medium text-slate-200">{areaId}</span>
              {area.compare ? (
                <div className="mt-1 text-slate-400">
                  compare: {area.compare.status}
                  {area.compare.compareOutputOrigin ? (
                    <>
                      {' '}
                      · {de.status.compareOutputOrigin}:{' '}
                      {originLabel(area.compare.compareOutputOrigin)}
                    </>
                  ) : null}
                  {area.compare.compareOutputGeneratedAt ? (
                    <div className="mt-0.5">
                      <StatusDateTime
                        value={area.compare.compareOutputGeneratedAt}
                        className="text-slate-400"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              {area.officialDownload ? (
                <div className="mt-1 text-slate-500">official: {area.officialDownload.status}</div>
              ) : null}
            </li>
          ))}
        </ul>
      </DetailRow>
    </DetailBox>
  )
}
