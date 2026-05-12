import {
  KPI_AREA_DELTA_STRONG_OVERLAP_MAX,
  KPI_HAUSDORFF_NORM_REVIEW,
  KPI_IOU_OVERLAP_GOOD,
  KPI_SYM_DIFF_STRONG_OVERLAP_MAX,
} from '@compare-metrics/kpiThresholds.ts'
import { metricInfoModalSectionsDe } from '@compare-metrics/metricInfoCopy.ts'
import { issueLevelLabelDe } from '../i18n/de'
import { cn } from '../lib/cn'
import { formatDeFixed, formatDeIou, formatDeMeters, formatDePercentPoints } from '../lib/formatDe'
import type { KpiVisualTier } from '../lib/kpiTier'
import { tierAreaDeltaAbs, tierHausdorffNorm, tierIou, tierSymmetricDiffPct } from '../lib/kpiTier'
import { InfoCircleIcon } from './InfoCircleIcon'

export type MetricModalBandKind =
  | 'iou'
  | 'areaDelta'
  | 'symDiff'
  | 'hausdorffMax'
  | 'hausdorffP95'
  | 'issueIndicator'
  | 'meanIou'

export type MetricModalBandContext = {
  iou?: number
  areaDiffPct?: number
  symmetricDiffPct?: number
  hausdorffM?: number
  hausdorffP95M?: number
  hausdorffNorm?: number
  meanIou?: number
  issueLevel?: 'ok' | 'review' | 'issue'
  metricsCrs?: string
}

type BandRow = { range: string; tier: KpiVisualTier; description: string }

function EinordnungHeadingRow({
  sectionTitle,
  cur,
  valueClassName,
}: {
  sectionTitle: string
  cur: { line: string } | null
  valueClassName?: string
}) {
  return (
    <header className="flex min-w-0 items-baseline justify-between gap-x-4 gap-y-1">
      <h3 className="shrink-0 text-sm font-semibold text-slate-200">{sectionTitle}</h3>
      {cur ? (
        <p className="min-w-0 text-right text-sm leading-snug font-semibold text-slate-200">
          <span className="font-medium text-slate-400">Aktuell</span>{' '}
          <span className={cn('tabular-nums', valueClassName)}>{cur.line}</span>
        </p>
      ) : null}
    </header>
  )
}

function tierInfoIconClass(tier: KpiVisualTier): string {
  if (tier === 'good') return 'text-emerald-400'
  if (tier === 'mid') return 'text-amber-400'
  if (tier === 'bad') return 'text-rose-400'
  return 'text-slate-400'
}

const bandsTableRowClass = 'border-b border-slate-800/90 last:border-b-0'

function BandsTable({ rows }: { rows: BandRow[] }) {
  return (
    <div className="rounded border border-slate-700/80 bg-slate-950/40 px-3 py-3">
      <table className="w-full table-auto text-xs">
        <tbody>
          {rows.map((row) => (
            <tr key={row.range} className={bandsTableRowClass}>
              <td className="w-px py-2 pr-2 align-middle" aria-hidden>
                <InfoCircleIcon className={cn('size-4 shrink-0', tierInfoIconClass(row.tier))} />
              </td>
              <td className="py-2 pr-3 align-middle font-medium whitespace-nowrap text-slate-200 tabular-nums">
                {row.range}
              </td>
              <td className="py-2 align-middle leading-snug text-pretty text-slate-400">
                {row.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function pct(n: number, fractionDigits: 1 | 2): string {
  return `${formatDeFixed(n, fractionDigits)} %`
}

function areaBands(): BandRow[] {
  return [
    {
      range: `|Δ Fläche| ≤ ${pct(KPI_AREA_DELTA_STRONG_OVERLAP_MAX, 2)}`,
      tier: 'good',
      description: 'Flächen sind in der Größe sehr nah beieinander.',
    },
    {
      range: `|Δ Fläche| > ${pct(KPI_AREA_DELTA_STRONG_OVERLAP_MAX, 2)}`,
      tier: 'mid',
      description: 'Größere Flächenabweichung, meist ein Fall für Prüfung.',
    },
  ]
}

function symBands(): BandRow[] {
  return [
    {
      range: `|Sym. Diff.| ≤ ${pct(KPI_SYM_DIFF_STRONG_OVERLAP_MAX, 2)}`,
      tier: 'good',
      description: 'Nur wenig Fläche gehört ausschließlich einer Quelle.',
    },
    {
      range: `|Sym. Diff.| > ${pct(KPI_SYM_DIFF_STRONG_OVERLAP_MAX, 2)}`,
      tier: 'mid',
      description: 'Mehr Abweichungsfläche zwischen den beiden Quellen.',
    },
  ]
}

function hausdorffMaxBands(): BandRow[] {
  return [
    {
      range: '(alle Werte)',
      tier: 'neutral',
      description:
        'Größter Abstand zwischen den Grenzlinien in Metern. Einzelne Spitzen können den Wert stark erhöhen.',
    },
  ]
}

function hausdorffP95Bands(): BandRow[] {
  return [
    {
      range: `Relativ < ${formatDeFixed(KPI_HAUSDORFF_NORM_REVIEW, 2)}`,
      tier: 'good',
      description: 'Die robuste Randabweichung ist relativ klein.',
    },
    {
      range: `Relativ ≥ ${formatDeFixed(KPI_HAUSDORFF_NORM_REVIEW, 2)}`,
      tier: 'mid',
      description: 'Relativ zur Gebietsgröße erhöhte Randabweichung.',
    },
  ]
}

function issueBands(): BandRow[] {
  return [
    {
      range: issueLevelLabelDe('ok'),
      tier: 'good',
      description: 'Unauffällige Kombination der Kennzahlen.',
    },
    {
      range: issueLevelLabelDe('review'),
      tier: 'mid',
      description: 'Auffällig, sollte geprüft werden.',
    },
    {
      range: issueLevelLabelDe('issue'),
      tier: 'bad',
      description: 'Klar problematische Kennzahlenkombination.',
    },
  ]
}

function bandsForKind(kind: MetricModalBandKind): BandRow[] {
  switch (kind) {
    case 'iou':
    case 'meanIou':
      return []
    case 'areaDelta':
      return areaBands()
    case 'symDiff':
      return symBands()
    case 'hausdorffMax':
      return hausdorffMaxBands()
    case 'hausdorffP95':
      return hausdorffP95Bands()
    case 'issueIndicator':
      return issueBands()
  }
}

function currentBlock(
  kind: MetricModalBandKind,
  ctx: MetricModalBandContext | undefined,
): { line: string; tier: KpiVisualTier } | null {
  if (!ctx) return null
  switch (kind) {
    case 'iou': {
      const v = ctx.iou
      if (v == null || !Number.isFinite(v)) return null
      return { line: formatDeIou(v), tier: tierIou(v) }
    }
    case 'meanIou': {
      const v = ctx.meanIou
      if (v == null || !Number.isFinite(v)) return null
      return { line: `${formatDeIou(v)} · Mittelwert`, tier: tierIou(v) }
    }
    case 'areaDelta': {
      const v = ctx.areaDiffPct
      if (v == null || !Number.isFinite(v)) return null
      return { line: formatDePercentPoints(v), tier: tierAreaDeltaAbs(Math.abs(v)) }
    }
    case 'symDiff': {
      const v = ctx.symmetricDiffPct
      if (v == null || !Number.isFinite(v)) return null
      return { line: formatDePercentPoints(v), tier: tierSymmetricDiffPct(Math.abs(v)) }
    }
    case 'hausdorffMax': {
      const m = ctx.hausdorffM
      if (m == null || !Number.isFinite(m)) return null
      return { line: formatDeMeters(m), tier: 'neutral' }
    }
    case 'hausdorffP95': {
      const m = ctx.hausdorffP95M
      const norm = ctx.hausdorffNorm
      if (m == null || !Number.isFinite(m)) return null
      return { line: formatDeMeters(m), tier: tierHausdorffNorm(norm) }
    }
    case 'issueIndicator': {
      const lvl = ctx.issueLevel
      if (!lvl) return null
      const tier: KpiVisualTier = lvl === 'ok' ? 'good' : lvl === 'review' ? 'mid' : 'bad'
      return { line: issueLevelLabelDe(lvl), tier }
    }
  }
}

/** IoU / mean IoU: table with info icon | range | description (no thead). */
function IouMeanIouTwoTierSection({
  kind,
  context,
}: {
  kind: 'iou' | 'meanIou'
  context?: MetricModalBandContext
}) {
  const cur = currentBlock(kind, context)
  const isMean = kind === 'meanIou'
  const t = formatDeIou(KPI_IOU_OVERLAP_GOOD)
  const rangeHigh = isMean ? `MW ≥ ${t}` : `IoU ≥ ${t}`
  const rangeLow = isMean ? `MW < ${t}` : `IoU < ${t}`
  const rangeZero = isMean ? 'MW = 0' : 'IoU = 0'
  const rowClass = bandsTableRowClass

  return (
    <div className="space-y-3">
      <EinordnungHeadingRow sectionTitle={metricInfoModalSectionsDe.bandsTwoTier} cur={cur} />
      <div className="rounded border border-slate-700/80 bg-slate-950/40 px-3 py-3">
        <table className="w-full table-auto text-xs">
          <tbody>
            <tr className={rowClass}>
              <td className="w-px py-2 pr-2 align-middle" aria-hidden>
                <InfoCircleIcon className={cn('size-4 shrink-0', tierInfoIconClass('good'))} />
              </td>
              <td className="py-2 pr-3 align-middle font-medium whitespace-nowrap text-slate-200 tabular-nums">
                {rangeHigh}
              </td>
              <td className="py-2 align-middle leading-snug text-pretty text-slate-400">
                Hohe Übereinstimmung der Flächen. Am Skalenende 1 liegt nahezu dieselbe Fläche vor.
              </td>
            </tr>
            <tr className={rowClass}>
              <td className="w-px py-2 pr-2 align-middle" aria-hidden>
                <InfoCircleIcon className={cn('size-4 shrink-0', tierInfoIconClass('mid'))} />
              </td>
              <td className="py-2 pr-3 align-middle font-medium whitespace-nowrap text-slate-200 tabular-nums">
                {rangeLow}
              </td>
              <td className="py-2 align-middle leading-snug text-pretty text-slate-400">
                Mehr Fläche ist nur einer Quelle zugeordnet.
              </td>
            </tr>
            <tr className={rowClass}>
              <td className="w-px py-2 pr-2 align-middle" aria-hidden>
                <InfoCircleIcon className={cn('size-4 shrink-0', tierInfoIconClass('neutral'))} />
              </td>
              <td className="py-2 pr-3 align-middle font-medium whitespace-nowrap text-slate-200 tabular-nums">
                {rangeZero}
              </td>
              <td className="py-2 align-middle leading-snug text-pretty text-slate-400">
                Keine gemeinsame Fläche.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function MetricModalBandsSection({
  kind,
  context,
}: {
  kind: MetricModalBandKind
  context?: MetricModalBandContext
}) {
  if (kind === 'iou' || kind === 'meanIou') {
    return <IouMeanIouTwoTierSection kind={kind} context={context} />
  }

  const rows = bandsForKind(kind)
  const cur = currentBlock(kind, context)
  const issueValueClass =
    kind === 'issueIndicator' && cur
      ? cur.tier === 'good'
        ? 'text-emerald-200'
        : cur.tier === 'mid' || cur.tier === 'bad'
          ? 'text-pink-200'
          : 'text-slate-200'
      : undefined

  return (
    <div className="space-y-3">
      <EinordnungHeadingRow
        sectionTitle={metricInfoModalSectionsDe.bandsTable}
        cur={cur}
        valueClassName={issueValueClass}
      />
      {!cur ? <p className="text-xs text-slate-500">Kein Messwert in diesem Kontext.</p> : null}
      <BandsTable rows={rows} />
    </div>
  )
}
