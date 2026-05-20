import { de } from '../i18n/de'
import type { ComparisonForReport } from '../types/report'
import { ProvenanceGridRow } from './ProvenanceGridRow'
import { ProvenanceGridSectionHeader } from './ProvenanceGridSectionHeader'

function metadataOrUnknown(value: string | undefined): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : de.provenance.unknown
}

function CompatibilityValue({ value }: { value: string | undefined }) {
  const p = de.provenance
  const key = (value?.trim() || 'unknown') as keyof typeof p.osmCompatibilityLabel
  const label = p.osmCompatibilityLabel[key] ?? p.osmCompatibilityLabel.unknown
  return (
    <span className={key === 'unknown' ? 'font-medium text-rose-300' : undefined}>{label}</span>
  )
}

export function ReportLicenseCompatibilitySection({
  data,
  className = '',
}: {
  data: ComparisonForReport
  className?: string
}) {
  const p = de.provenance
  const off = data.sourceMetadata?.official

  return (
    <section
      id="report-licence-section"
      className={`overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 text-sm text-slate-400 shadow-sm ${className}`.trim()}
      aria-label={p.licenseSectionHeading}
    >
      <ProvenanceGridSectionHeader title={p.licenseSectionHeading} />
      <div className="border-t border-slate-700">
        <dl className="divide-y divide-slate-700/80">
          <ProvenanceGridRow
            asDl
            rightColumnClassName="mt-2"
            title={<h3 className="text-sm/6 font-medium text-slate-200">{p.officialHeading}</h3>}
          >
            <ul className="space-y-1 text-slate-300">
              <li>
                <span className="text-slate-500">{p.licenseShortNameLabel}: </span>
                {metadataOrUnknown(off?.licenseLabel ?? off?.license)}
              </li>
              <li>
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
              </li>
              <li>
                <span className="text-slate-500">{p.osmCompatibilityLabelTitle}: </span>
                <CompatibilityValue value={off?.osmCompatibility} />
              </li>
              <li>
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
              </li>
              {off?.osmCompatibilityComment?.trim() ? (
                <li className="text-slate-400">{off.osmCompatibilityComment.trim()}</li>
              ) : null}
            </ul>
          </ProvenanceGridRow>
        </dl>
      </div>
    </section>
  )
}
