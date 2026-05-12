import type { ReactNode } from 'react'
import type { KpiVisualTier } from '../lib/kpiTier'
import { KPI_TIER_ARIA_DE, KPI_TIER_DOT_CLASS } from '../lib/kpiTier'

export function KpiStatusDot({ tier }: { tier: KpiVisualTier }) {
  return (
    <span
      role="img"
      aria-label={KPI_TIER_ARIA_DE[tier]}
      title={KPI_TIER_ARIA_DE[tier]}
      className={`inline-block size-2 shrink-0 rounded-full ${KPI_TIER_DOT_CLASS[tier]}`}
    />
  )
}

/** Compact single-line hint + colored dot below KPI values. */
export function KpiHintInline({ children, tier }: { children: ReactNode; tier: KpiVisualTier }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 text-xs leading-snug text-slate-500">
      <span className="min-w-0 whitespace-nowrap">{children}</span>
      <KpiStatusDot tier={tier} />
    </span>
  )
}
