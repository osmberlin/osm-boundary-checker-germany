import { de } from '../i18n/de'
import { EM_DASH } from '../lib/formatDe'
import { formatFreshnessDisplayDe } from '../lib/formatSourceDownloadedAt'
import { optionalSourceStatLines, sourceStatLines } from '../lib/reportFreshnessLines'
import type { ComparisonForReport } from '../types/report'

export type ReportDataProvenanceFooterProps = {
  data: ComparisonForReport
  className?: string
}

function metadataOrUnknown(value: string | undefined): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : de.provenance.unknown
}

function CompatibilityValue({ value }: { value: string | undefined }) {
  const p = de.provenance
  const key = (value?.trim() || 'unknown') as keyof typeof p.osmCompatibilityLabel
  return p.osmCompatibilityLabel[key] ?? p.osmCompatibilityLabel.unknown
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
  const osmMeta = [osm?.provider, osm?.dataset].filter(Boolean).join(' · ')

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

      <div className="mt-6 mb-4 rounded border border-slate-700/80 bg-slate-950/40 p-3">
        <h4 className="mb-2 text-sm font-medium text-slate-200">{p.licenseSectionHeading}</h4>
        <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-medium text-slate-200">{p.officialHeading}</p>
            <p>
              <span className="text-slate-500">{p.licenseShortNameLabel}: </span>
              {metadataOrUnknown(off?.licenseLabel ?? off?.license)}
            </p>
            <p>
              <span className="text-slate-500">{p.licenseSourceLabel}: </span>
              {off?.licenseSourceUrl?.trim() ? (
                <a
                  className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
                  href={off.licenseSourceUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.sourceLinkLabel}
                </a>
              ) : (
                p.unknown
              )}
            </p>
            <p>
              <span className="text-slate-500">{p.osmCompatibilityLabelTitle}: </span>
              <CompatibilityValue value={off?.osmCompatibility} />
            </p>
            <p>
              <span className="text-slate-500">{p.osmCompatibilitySourceLabel}: </span>
              {off?.osmCompatibilitySourceUrl?.trim() ? (
                <a
                  className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
                  href={off.osmCompatibilitySourceUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.sourceLinkLabel}
                </a>
              ) : (
                p.unknown
              )}
            </p>
            {off?.osmCompatibilityComment?.trim() ? (
              <p className="text-slate-400">{off.osmCompatibilityComment.trim()}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className="font-medium text-slate-200">{p.osmHeading}</p>
            <p>
              <span className="text-slate-500">{p.licenseShortNameLabel}: </span>
              {metadataOrUnknown(osm?.licenseLabel ?? osm?.license)}
            </p>
            <p>
              <span className="text-slate-500">{p.licenseSourceLabel}: </span>
              {osm?.licenseSourceUrl?.trim() ? (
                <a
                  className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
                  href={osm.licenseSourceUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.sourceLinkLabel}
                </a>
              ) : (
                p.unknown
              )}
            </p>
            <p>
              <span className="text-slate-500">{p.osmCompatibilityLabelTitle}: </span>
              <CompatibilityValue value={osm?.osmCompatibility} />
            </p>
            <p>
              <span className="text-slate-500">{p.osmCompatibilitySourceLabel}: </span>
              {osm?.osmCompatibilitySourceUrl?.trim() ? (
                <a
                  className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
                  href={osm.osmCompatibilitySourceUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.sourceLinkLabel}
                </a>
              ) : (
                p.unknown
              )}
            </p>
            {osm?.osmCompatibilityComment?.trim() ? (
              <p className="text-slate-400">{osm.osmCompatibilityComment.trim()}</p>
            ) : null}
          </div>
        </div>
      </div>

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
    </section>
  )
}
