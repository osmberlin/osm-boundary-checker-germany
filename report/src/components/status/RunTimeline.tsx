import { format } from 'date-fns'
import { de as deLocale } from 'date-fns/locale/de'
import { de } from '../../i18n/de'
import { cn } from '../../lib/cn'
import { formatIsoTimestampTooltipDe } from '../../lib/formatSourceDownloadedAt'
import {
  fmtDurationMs,
  groupRunsByBerlinDay,
  runAnchorId,
  type RunPhase,
  type RunView,
} from '../../lib/processingRuns'
import { StatusDateTime } from '../../lib/statusDateTime'
import { berlinTodayDateKey, parseBerlinDateKey } from '../../lib/time/calendar'
import { isScheduledRefreshDay, scheduledRefreshAtIso } from '../../lib/time/schedule'

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

function phaseLetter(phase: RunPhase): string {
  switch (phase) {
    case 'download':
      return 'D'
    case 'extract':
      return 'E'
    case 'compare':
      return 'C'
    case 'all':
      return 'A'
    default:
      return '?'
  }
}

function markerClasses(phase: RunPhase, status?: 'ok' | 'fail'): string {
  const base =
    'flex h-7 w-7 items-center justify-center rounded text-xs font-semibold no-underline transition hover:ring-2 hover:ring-sky-500/50'
  const phaseColor =
    phase === 'download'
      ? 'bg-sky-900/80 text-sky-100'
      : phase === 'extract'
        ? 'bg-amber-900/80 text-amber-100'
        : phase === 'compare'
          ? 'bg-violet-900/80 text-violet-100'
          : 'bg-slate-700 text-slate-200'
  const border =
    status === 'fail'
      ? 'ring-2 ring-red-500/80'
      : status === 'ok'
        ? 'ring-1 ring-emerald-600/50'
        : 'ring-1 ring-slate-600'
  return cn(base, phaseColor, border)
}

function scheduledMarkerClasses(): string {
  return cn(
    'flex h-7 w-7 items-center justify-center rounded border border-dashed border-slate-500 text-xs font-medium text-slate-400',
  )
}

function formatDayHeader(dateKey: string): { weekday: string; label: string } {
  const d = parseBerlinDateKey(dateKey)
  if (!d) return { weekday: '', label: dateKey }
  return {
    weekday: format(d, 'EEE', { locale: deLocale }),
    label: format(d, 'd. MMM', { locale: deLocale }),
  }
}

function runTooltip(run: RunView): string {
  const parts = [
    phaseLabel(run.phase),
    run.startedAt ? formatIsoTimestampTooltipDe(run.startedAt) : '',
    fmtDurationMs(run.durationMs),
    run.status ?? '',
  ].filter(Boolean)
  return parts.join(' · ')
}

export function RunTimeline({ runs, dateKeys }: { runs: RunView[]; dateKeys: string[] }) {
  const todayKey = berlinTodayDateKey()
  const byDay = groupRunsByBerlinDay(runs)

  return (
    <section className="mt-8" aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="text-lg font-medium text-slate-100">
        {de.status.timelineHeading}
      </h2>
      <div className="mt-4 overflow-x-auto pb-2" role="img" aria-label={de.status.timelineAria}>
        <div className="flex min-w-max gap-1">
          {dateKeys.map((dateKey) => {
            const { weekday, label } = formatDayHeader(dateKey)
            const isToday = dateKey === todayKey
            const dayRuns = byDay.get(dateKey) ?? []
            const isFuture = dateKey > todayKey
            const scheduled = isScheduledRefreshDay(dateKey)

            const showScheduled = isFuture && scheduled

            return (
              <div
                key={dateKey}
                className={cn(
                  'flex w-[4.25rem] shrink-0 flex-col items-center border-b border-transparent px-0.5 pb-2',
                  isToday && 'rounded-t border-slate-600 bg-slate-800/60',
                )}
              >
                <span className="text-[10px] tracking-wide text-slate-500 uppercase">
                  {weekday}
                </span>
                <span
                  className={cn('text-xs font-medium', isToday ? 'text-sky-300' : 'text-slate-300')}
                >
                  {label}
                </span>
                {isToday ? (
                  <span className="mt-0.5 text-[10px] text-sky-400">{de.status.timelineToday}</span>
                ) : (
                  <span className="mt-0.5 h-[14px]" aria-hidden />
                )}
                <div className="mt-2 flex min-h-[4.5rem] flex-col items-center gap-1">
                  {dayRuns.map((run) => (
                    <a
                      key={run.runId}
                      href={`#${runAnchorId(run.runId)}`}
                      className={markerClasses(run.phase, run.status)}
                      title={runTooltip(run)}
                    >
                      {phaseLetter(run.phase)}
                    </a>
                  ))}
                  {showScheduled ? (
                    <span
                      className={scheduledMarkerClasses()}
                      title={`${de.status.timelineScheduled}: ${de.status.timelineLegendScheduled}`}
                    >
                      ○
                    </span>
                  ) : null}
                  {!isFuture && dayRuns.length === 0 && scheduled ? (
                    <span className="h-7 w-7" aria-hidden />
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <li>
          <span className={markerClasses('download', 'ok')}>D</span>{' '}
          {de.status.timelineLegendDownload}
        </li>
        <li>
          <span className={markerClasses('extract', 'ok')}>E</span>{' '}
          {de.status.timelineLegendExtract}
        </li>
        <li>
          <span className={markerClasses('compare', 'ok')}>C</span>{' '}
          {de.status.timelineLegendCompare}
        </li>
        <li>
          <span className={scheduledMarkerClasses()}>○</span> {de.status.timelineLegendScheduled}
        </li>
      </ul>
      {scheduledRefreshAtIso(todayKey) && isScheduledRefreshDay(todayKey) ? (
        <p className="mt-2 text-xs text-slate-500">
          {de.status.timelineScheduled}:{' '}
          <StatusDateTime value={scheduledRefreshAtIso(todayKey)} variant="inline" />
        </p>
      ) : null}
    </section>
  )
}
