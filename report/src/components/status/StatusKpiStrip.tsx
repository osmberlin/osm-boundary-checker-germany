import { de } from '../../i18n/de'
import { cn } from '../../lib/cn'
import type { StatusKpis } from '../../lib/processingRuns'
import { StatusDateTime } from '../../lib/statusDateTime'

function KpiCard({
  title,
  value,
  note,
  tone,
}: {
  title: string
  value?: string
  note: string
  tone: 'sky' | 'emerald' | 'violet'
}) {
  const toneClasses = {
    sky: {
      footerBg: 'bg-sky-950/20',
      footerBorder: 'border-sky-900/40',
      border: 'border-sky-900/30',
      date: 'text-sky-400',
    },
    emerald: {
      footerBg: 'bg-emerald-950/20',
      footerBorder: 'border-emerald-900/40',
      border: 'border-emerald-900/30',
      date: 'text-emerald-400',
    },
    violet: {
      footerBg: 'bg-violet-950/20',
      footerBorder: 'border-violet-900/40',
      border: 'border-violet-900/30',
      date: 'text-violet-400',
    },
  }[tone]

  return (
    <article
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-lg border bg-slate-900/40',
        toneClasses.border,
      )}
    >
      <div className="min-w-0 flex-1 px-4 pt-4 sm:px-5">
        <p className="truncate text-base font-normal text-slate-100">{title}</p>
        <div className="mt-2">
          {value ? (
            <StatusDateTime
              value={value}
              variant="kpi"
              className="w-full"
              dateClassName={toneClasses.date}
              timeClassName="text-slate-500"
              relativeClassName="text-slate-500"
            />
          ) : (
            <p className="text-sm text-slate-500">{de.status.timestampMissing}</p>
          )}
        </div>
      </div>
      <div
        className={cn(
          'mt-4 border-t px-4 py-2.5 text-xs text-slate-400 sm:px-5',
          toneClasses.footerBg,
          toneClasses.footerBorder,
        )}
      >
        {note}
      </div>
    </article>
  )
}

export function StatusKpiStrip({ kpis }: { kpis: StatusKpis }) {
  return (
    <section aria-labelledby="status-kpi-heading">
      <h2 id="status-kpi-heading" className="text-lg font-medium text-slate-100">
        {de.status.kpiHeading}
      </h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <KpiCard
          title={de.status.kpiLastCompare}
          value={kpis.lastCompareOkAt}
          note={de.status.kpiLastCompareHint}
          tone="violet"
        />
        <KpiCard
          title={de.status.kpiLastDownload}
          value={kpis.lastDownloadOkAt}
          note={de.status.kpiLastDownloadHint}
          tone="sky"
        />
        <KpiCard
          title={de.status.kpiLastPublished}
          value={kpis.lastPublishedAt}
          note={de.status.kpiLastPublishedHint}
          tone="emerald"
        />
      </div>
    </section>
  )
}
