import { de } from '../../i18n/de'
import type { ReportRow } from '../../types/report'

function ValueRow({ label, value }: { label: string; value: string | null | undefined }) {
  const display = value && value.length > 0 ? value : de.feature.osmKeyDiagnosticsValueAbsent
  return (
    <div className="contents">
      <dt className="font-mono text-xs break-words text-slate-400">{label}</dt>
      <dd className="font-mono break-words text-slate-100">{display}</dd>
    </div>
  )
}

function PlainRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="font-mono text-xs break-words text-slate-400">{label}</dt>
      <dd className="break-words text-slate-100">{value}</dd>
    </div>
  )
}

/**
 * Shown when the dataset uses AGS-first matching (osmProfile=admin_ags).
 * Surfaces the OSM-side `de:amtlicher_gemeindeschluessel` / `de:regionalschluessel` raw values,
 * the AGS-from-RS fallback derivation, and which match path was used.
 */
export function OsmKeyDiagnosticsSection({ row }: { row: ReportRow }) {
  const diag = row.osmMatchDiagnostics
  if (!diag) return null
  if (row.category !== 'matched' && row.category !== 'unmatched_osm') return null

  const s = de.feature
  const matchPathLabel =
    diag.matchPath === 'ags_direct'
      ? s.osmKeyDiagnosticsMatchPathAgsDirect
      : diag.matchPath === 'ags_from_rs_fallback'
        ? s.osmKeyDiagnosticsMatchPathAgsFromRs
        : s.osmKeyDiagnosticsMatchPathNone

  return (
    <section
      className="mt-10 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={s.osmKeyDiagnosticsSectionAria}
    >
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">
          {s.osmKeyDiagnosticsSectionTitle}
        </h2>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">{s.osmKeyDiagnosticsSectionLead}</p>
      </div>
      <div className="border-t border-slate-700">
        <dl className="grid gap-x-3 gap-y-2 px-4 py-6 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:px-6">
          <ValueRow label={s.osmKeyDiagnosticsAgsLabel} value={diag.agsRaw} />
          <ValueRow label={s.osmKeyDiagnosticsRsLabel} value={diag.rsRaw} />
          <ValueRow label={s.osmKeyDiagnosticsAgsFromRsLabel} value={diag.agsFromRs} />
          <PlainRow label={s.osmKeyDiagnosticsMatchPathLabel} value={matchPathLabel} />
          {diag.missingRecommendedTags.length > 0 ? (
            <PlainRow
              label={s.osmKeyDiagnosticsMissingTagsLabel}
              value={diag.missingRecommendedTags.join(', ')}
            />
          ) : null}
        </dl>
      </div>
    </section>
  )
}
