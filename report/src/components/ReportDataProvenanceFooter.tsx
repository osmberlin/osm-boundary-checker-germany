import { Link } from 'react-router-dom'
import { de } from '../i18n/de'
import { EM_DASH } from '../lib/formatDe'
import { formatFreshnessDisplayDe } from '../lib/formatSourceDownloadedAt'
import { sourceStatLines } from '../lib/reportFreshnessLines'
import type { ComparisonForReport } from '../types/report'

export type ReportDataProvenanceFooterProps = {
  data: ComparisonForReport
  areaId: string
  snapshot?: string | null
  /** Omit cross-link to /:areaId/unmatched (e.g. on that page). */
  hideUnmatchedCrossLink?: boolean
  className?: string
}

function DateLine({ label, abs, rel }: { label: string; abs: string; rel: string }) {
  const bothDash = abs === EM_DASH && rel === EM_DASH
  return (
    <p className="text-slate-300">
      <span className="font-medium text-slate-200">{label}:</span>{' '}
      {bothDash ? (
        EM_DASH
      ) : (
        <>
          <span className="tabular-nums">{abs}</span>
          {rel !== EM_DASH ? <span className="text-slate-500"> ({rel})</span> : null}
        </>
      )}
    </p>
  )
}

export function ReportDataProvenanceFooter({
  data,
  areaId,
  snapshot = null,
  hideUnmatchedCrossLink = false,
  className = '',
}: ReportDataProvenanceFooterProps) {
  const p = de.provenance
  const reportFresh = formatFreshnessDisplayDe(data.generatedAt.trim())
  const officialFresh = sourceStatLines(
    data.sourceMetadata?.official?.downloadedAt,
    data.sourceMetadata?.official != null,
  )
  const osmFresh = sourceStatLines(
    data.sourceMetadata?.osm?.downloadedAt,
    data.sourceMetadata?.osm != null,
  )

  const off = data.sourceMetadata?.official
  const osm = data.sourceMetadata?.osm
  const officialMeta = [off?.provider, off?.dataset, off?.layer].filter(Boolean).join(' · ')
  const osmMeta = [osm?.provider, osm?.dataset].filter(Boolean).join(' · ')

  const unmatchedN = data.unmatchedOsm?.length ?? 0
  const snap = snapshot && String(snapshot).length > 0 ? String(snapshot) : null
  const unmatchedHref = snap
    ? `/${areaId}/unmatched?snapshot=${encodeURIComponent(snap)}`
    : `/${areaId}/unmatched`

  const wrap = className ? className : ''

  return (
    <section
      className={`mt-10 rounded border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400 ${wrap}`.trim()}
      aria-label={p.sectionAria}
    >
      <h2 className="mb-4 text-base font-semibold text-slate-100">{p.title}</h2>

      <div className="mb-6 space-y-1 border-b border-slate-700 pb-4">
        <DateLine
          label={p.reportCreatedLabel}
          abs={reportFresh.absoluteLine || EM_DASH}
          rel={reportFresh.relativeLine ?? EM_DASH}
        />
        <DateLine
          label={p.officialDownloadLabel}
          abs={officialFresh.absoluteLine}
          rel={officialFresh.relativeLine}
        />
        <DateLine
          label={p.osmDownloadLabel}
          abs={osmFresh.absoluteLine}
          rel={osmFresh.relativeLine}
        />
      </div>

      <h3 className="mb-2 font-medium text-slate-200">{p.officialHeading}</h3>
      <p className="mb-2 text-pretty">{p.officialLead}</p>
      {officialMeta ? (
        <p className="mb-2 text-slate-500">
          {p.officialMetaPrefix}: {officialMeta}
        </p>
      ) : null}
      {off?.sourceUrl?.trim() ? (
        <p className="mb-2">
          <a
            className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
            href={off.sourceUrl.trim()}
            target="_blank"
            rel="noreferrer"
          >
            {p.sourceLinkLabel}
          </a>
        </p>
      ) : null}
      {off?.license?.trim() ? (
        <p className="mb-4 text-xs text-slate-500">
          {p.licenseLabel}: {off.license.trim()}
        </p>
      ) : (
        <div className="mb-4" />
      )}

      <h3 className="mb-2 font-medium text-slate-200">{p.osmHeading}</h3>
      <p className="mb-2 text-pretty">{p.osmLead}</p>
      {osmMeta ? <p className="mb-2 text-slate-500">{osmMeta}</p> : null}
      {osm?.sourceUrl?.trim() ? (
        <p className="mb-2">
          <a
            className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
            href={osm.sourceUrl.trim()}
            target="_blank"
            rel="noreferrer"
          >
            {p.sourceLinkLabel}
          </a>
        </p>
      ) : null}
      {osm?.license?.trim() ? (
        <p className="mb-2 text-xs text-slate-500">
          {p.licenseLabel}: {osm.license.trim()}
        </p>
      ) : null}

      <p className="mb-2 font-medium text-slate-300">{p.osmFilterTitle}</p>
      <p className="mb-4 text-pretty">{p.osmFilterBody}</p>

      {osm?.note?.trim() ? (
        <>
          <p className="mb-1 font-medium text-slate-300">{p.osmFilterNoteTitle}</p>
          <pre className="mb-4 overflow-x-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs break-words whitespace-pre-wrap text-slate-300">
            {osm.note.trim()}
          </pre>
        </>
      ) : null}

      {!hideUnmatchedCrossLink && unmatchedN > 0 ? (
        <p className="mt-4 text-pretty text-slate-400">
          {p.unmatchedCrossLinkIntro}{' '}
          <Link className="text-sky-400 underline" to={unmatchedHref}>
            {de.areaReport.unmatchedPageLink}
          </Link>
        </p>
      ) : null}
    </section>
  )
}
