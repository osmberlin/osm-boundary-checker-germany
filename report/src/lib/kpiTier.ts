import {
  KPI_AREA_DELTA_HIGH,
  KPI_AREA_DELTA_STRONG_OVERLAP_MAX,
  KPI_HAUSDORFF_NORM_REVIEW,
  KPI_HAUSDORFF_NORM_SEVERE,
  KPI_IOU_OVERLAP_GOOD,
  KPI_SYM_DIFF_OVERLAP_GOOD_MAX,
  KPI_SYM_DIFF_STRONG_OVERLAP_MAX,
} from '@compare-metrics/kpiThresholds.ts'

/** Visual tier for KPI hints and modal tables. */
export type KpiVisualTier = 'good' | 'mid' | 'bad' | 'neutral'

export const KPI_TIER_DOT_CLASS: Record<KpiVisualTier, string> = {
  good: 'bg-emerald-400',
  mid: 'bg-amber-400',
  bad: 'bg-rose-400',
  neutral: 'bg-slate-500',
}

export const KPI_TIER_ARIA_DE: Record<KpiVisualTier, string> = {
  good: 'Einstufung: gut',
  mid: 'Einstufung: mittel',
  bad: 'Einstufung: kritisch',
  neutral: 'Keine Einordnung',
}

/** Default (non-hover) text color for metric info trigger beside KPIs; pair with `hover:text-sky-400` on the control. */
export const KPI_TIER_INFO_BUTTON_CLASS: Record<KpiVisualTier, string> = {
  good: 'text-emerald-400 hover:text-sky-400',
  mid: 'text-amber-400 hover:text-sky-400',
  bad: 'text-rose-400 hover:text-sky-400',
  neutral: 'text-slate-400 hover:text-sky-400',
}

export function tierIou(iou: number): KpiVisualTier {
  if (!Number.isFinite(iou)) return 'neutral'
  if (iou >= KPI_IOU_OVERLAP_GOOD) return 'good'
  if (iou >= 0.7) return 'mid'
  return 'bad'
}

export function tierAreaDeltaAbs(absPct: number): KpiVisualTier {
  if (!Number.isFinite(absPct)) return 'neutral'
  if (absPct <= KPI_AREA_DELTA_STRONG_OVERLAP_MAX) return 'good'
  if (absPct <= KPI_AREA_DELTA_HIGH) return 'mid'
  return 'bad'
}

export function tierSymmetricDiffPct(symPct: number): KpiVisualTier {
  if (!Number.isFinite(symPct)) return 'neutral'
  if (symPct <= KPI_SYM_DIFF_STRONG_OVERLAP_MAX) return 'good'
  if (symPct <= KPI_SYM_DIFF_OVERLAP_GOOD_MAX) return 'mid'
  return 'bad'
}

export function tierHausdorffNorm(norm: number | null | undefined): KpiVisualTier {
  if (norm == null || !Number.isFinite(norm)) return 'neutral'
  const n = Math.abs(norm)
  if (n < KPI_HAUSDORFF_NORM_REVIEW) return 'good'
  if (n < KPI_HAUSDORFF_NORM_SEVERE) return 'mid'
  return 'bad'
}
