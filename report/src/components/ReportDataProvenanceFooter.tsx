import { de } from '../i18n/de'
import { EM_DASH } from '../lib/formatDe'
import { formatFreshnessDisplayDe } from '../lib/formatSourceDownloadedAt'
import { optionalSourceStatLines, sourceStatLines } from '../lib/reportFreshnessLines'
import type { ComparisonForReport } from '../types/report'

export type ReportDataProvenanceFooterProps = {
  data: ComparisonForReport
  className?: string
  hideFreshnessSection?: boolean
}

function SourceLinks({
  publicUrl,
  downloadUrl,
}: {
  publicUrl: string | undefined
  downloadUrl: string | undefined
}) {
  const p = de.provenance
  const publicHref = publicUrl?.trim() || undefined
  const downloadHref = downloadUrl?.trim() || undefined
  if (!publicHref && !downloadHref) return null

  return (
    <p className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {publicHref ? (
        <a
          className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
          href={publicHref}
          target="_blank"
          rel="noreferrer"
        >
          {p.sourcePublicLinkLabel}
        </a>
      ) : null}
      {downloadHref ? (
        <a
          className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
          href={downloadHref}
          target="_blank"
          rel="noreferrer"
        >
          {p.sourceDownloadLinkLabel}
        </a>
      ) : null}
    </p>
  )
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
  className = '',
  hideFreshnessSection = false,
}: ReportDataProvenanceFooterProps) {
  const p = de.provenance
  const reportFresh = formatFreshnessDisplayDe(data.generatedAt.trim())
  const officialFresh = sourceStatLines(
    data.sourceMetadata?.official?.downloadedAt,
    data.sourceMetadata?.official != null,
  )
  const officialUpdatedFresh = optionalSourceStatLines(
    data.sourceMetadata?.official?.sourceUpdatedAt,
  )
  const officialPublishedFresh = optionalSourceStatLines(
    data.sourceMetadata?.official?.sourcePublishedAt,
  )
  const osmFresh = sourceStatLines(
    data.sourceMetadata?.osm?.downloadedAt,
    data.sourceMetadata?.osm != null,
  )

  const off = data.sourceMetadata?.official
  const osm = data.sourceMetadata?.osm
  const officialMeta = [off?.provider, off?.dataset, off?.layer].filter(Boolean).join(' · ')

  return (
    <section
      className={`mt-14 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 text-sm text-slate-400 shadow-sm ${className}`.trim()}
      aria-label={p.sectionAria}
    >
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">{p.title}</h2>
      </div>

      {!hideFreshnessSection ? (
        <div className="space-y-1 border-t border-b border-slate-700 px-4 py-6 sm:px-6">
          <DateLine
            label={p.reportCreatedLabel}
            abs={reportFresh.absoluteLine || EM_DASH}
            rel={reportFresh.relativeLine ?? EM_DASH}
          />
          {officialUpdatedFresh ? (
            <DateLine
              label={p.officialSourceUpdatedLabel}
              abs={officialUpdatedFresh.absoluteLine}
              rel={officialUpdatedFresh.relativeLine}
            />
          ) : null}
          {officialPublishedFresh ? (
            <DateLine
              label={p.officialSourcePublishedLabel}
              abs={officialPublishedFresh.absoluteLine}
              rel={officialPublishedFresh.relativeLine}
            />
          ) : null}
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
      ) : null}

      <div className="border-t border-slate-700">
        <dl className="divide-y divide-slate-700/80">
          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{p.officialHeading}</h3>
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <p className="mb-2 text-pretty">{p.officialLead}</p>
              {officialMeta ? (
                <p className="mb-2 text-slate-500">
                  {p.officialMetaPrefix}: {officialMeta}
                </p>
              ) : null}
              <SourceLinks publicUrl={off?.sourcePublicUrl} downloadUrl={off?.sourceDownloadUrl} />
              {off?.license?.trim() ? (
                <p className="mb-4 text-xs text-slate-500">
                  {p.licenseLabel}: {off.license.trim()}
                </p>
              ) : (
                <div className="mb-4" />
              )}
            </dd>
          </div>

          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{p.osmHeading}</h3>
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <p className="mb-2 text-pretty">{p.osmLead}</p>
              <SourceLinks publicUrl={osm?.sourcePublicUrl} downloadUrl={osm?.sourceDownloadUrl} />
            </dd>
          </div>
          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{p.osmFilterTitle}</h3>
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <p className="text-pretty">{p.osmFilterBody}</p>
              {osm?.note?.trim() ? (
                <>
                  <p className="mt-4 mb-1 font-medium text-slate-300">{p.osmFilterNoteTitle}</p>
                  <pre className="mb-0 overflow-x-auto rounded border border-slate-800 bg-slate-950 p-3 font-mono text-xs break-words whitespace-pre-wrap text-slate-300">
                    {osm.note.trim()}
                  </pre>
                </>
              ) : null}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
