import { issueLevelLabelDe } from '../i18n/de'
import { EM_DASH } from '../lib/formatDe'

export function IssueBadge({ level }: { level: 'ok' | 'review' | 'issue' | undefined }) {
  if (!level) return <span className="text-slate-500">{EM_DASH}</span>
  const classes =
    level === 'ok'
      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
      : level === 'review'
        ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
        : 'border-rose-400/40 bg-rose-500/15 text-rose-300'
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${classes}`}>
      {issueLevelLabelDe(level)}
    </span>
  )
}
