import { type RefObject, useEffect, useRef, useState } from 'react'
import type { SourceKind } from '../../../scripts/shared/sourceKind.ts'
import { de } from '../i18n/de'
import { SourceTerm, sourceText } from '../i18n/sourceVocabulary'
import { formatDeInteger } from '../lib/formatDe'
import {
  compatibleShareLabel,
  resolveRowLicense,
  type ResolvedLicense,
} from '../lib/resolveRowLicense'
import type { ComparisonForReport, LicenseBreakdownEntry, ReportRow } from '../types/report'
import { ProvenanceGridRow } from './ProvenanceGridRow'
import { ProvenanceGridSectionHeader } from './ProvenanceGridSectionHeader'

const externalLinkClass =
  'text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300'

function metadataOrUnknown(value: string | undefined): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : de.provenance.unknown
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a className={externalLinkClass} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

function CompatibilityValue({ value }: { value: string | undefined }) {
  const p = de.provenance
  const key = (value?.trim() || 'unknown') as keyof typeof p.osmCompatibilityLabel
  const label = p.osmCompatibilityLabel[key] ?? p.osmCompatibilityLabel.unknown
  return (
    <span className={key === 'unknown' ? 'font-medium text-rose-300' : undefined}>{label}</span>
  )
}

function formatDecisionDate(date: string): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('de-DE', { timeZone: 'UTC' })
}

/** One licence (dataset block or the licence of a single geometry). */
function ResolvedLicenseList({
  license,
  sourceKind,
}: {
  license: ResolvedLicense
  sourceKind: SourceKind | undefined
}) {
  const p = de.provenance
  const g = p.licensePerGeometry
  return (
    <ul className="space-y-1 text-slate-300">
      {license.isRowLicense ? (
        <li>
          <span className="text-slate-500">{g.geometrySourceLabel}: </span>
          {license.sourceName ? (
            <>
              {license.sourceUrl ? (
                <ExternalLink href={license.sourceUrl}>{license.sourceName}</ExternalLink>
              ) : (
                license.sourceName
              )}
              <SourceTerm kind={sourceKind} term="geometrySourceVia" />
            </>
          ) : (
            g.unknownSource
          )}
        </li>
      ) : null}
      <li>
        <span className="text-slate-500">{p.licenseShortNameLabel}: </span>
        {metadataOrUnknown(license.licenseLabel)}
      </li>
      <li>
        <span className="text-slate-500">{p.licenseSourceLabel}: </span>
        {license.licenseSourceUrl ? (
          <ExternalLink href={license.licenseSourceUrl}>{p.sourceLinkLabel}</ExternalLink>
        ) : (
          p.unknown
        )}
      </li>
      <li>
        <span className="text-slate-500">{p.osmCompatibilityLabelTitle}: </span>
        <CompatibilityValue value={license.osmCompatibility} />
      </li>
      <li>
        <span className="text-slate-500">{p.osmCompatibilitySourceLabel}: </span>
        {license.osmCompatibilitySourceUrl ? (
          <ExternalLink href={license.osmCompatibilitySourceUrl}>{p.sourceLinkLabel}</ExternalLink>
        ) : (
          p.unknown
        )}
      </li>
      {license.osmCompatibilityComment ? (
        <li className="text-slate-400">{license.osmCompatibilityComment}</li>
      ) : null}
    </ul>
  )
}

function BreakdownRow({ entry }: { entry: LicenseBreakdownEntry }) {
  const p = de.provenance
  const g = p.licensePerGeometry
  const source = entry.sourceName ?? g.unknownSource
  return (
    <tr className="border-t border-slate-800/80 align-top">
      <td className="px-3 py-2">
        {entry.sourceUrl ? <ExternalLink href={entry.sourceUrl}>{source}</ExternalLink> : source}
      </td>
      <td className="px-3 py-2">
        {entry.licenseLabel === 'unknown' ? p.unknown : entry.licenseLabel}
        {entry.licenseSourceUrl ? (
          <a
            className={`ml-2 ${externalLinkClass}`}
            href={entry.licenseSourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            {p.licenseSourceLabel}
          </a>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{formatDeInteger(entry.rowCount)}</td>
      <td className="px-3 py-2">
        <CompatibilityValue value={entry.osmCompatibility} />
      </td>
      <td className="px-3 py-2">
        {entry.osmCompatibilityComment ? <span>{entry.osmCompatibilityComment}</span> : null}
        <span className="mt-1 block text-slate-500">
          {entry.ruleId ? <code>{entry.ruleId}</code> : p.unknown}
          {entry.osmCompatibilitySourceUrl ? (
            <>
              {' · '}
              <ExternalLink href={entry.osmCompatibilitySourceUrl}>{g.evidenceLink}</ExternalLink>
            </>
          ) : null}
          {entry.decidedAt ? ` · ${g.decidedAt(formatDecisionDate(entry.decidedAt))}` : null}
        </span>
      </td>
    </tr>
  )
}

const LICENSE_SECTION_HASH = '#report-licence-section'

function isCompatible(entry: LicenseBreakdownEntry): boolean {
  return entry.osmCompatibility === 'yes_licence' || entry.osmCompatibility === 'yes_waiver'
}

/**
 * Area report for datasets with a licence per geometry: short summary (like the home page) and the
 * full source × licence table behind a disclosure. The disclosure opens (and the section scrolls
 * into view) when the page is opened with, or navigated to, `#report-licence-section`.
 */
function LicenseBreakdownDisclosure({
  breakdown,
  sectionRef,
}: {
  breakdown: LicenseBreakdownEntry[]
  sectionRef: RefObject<HTMLElement | null>
}) {
  const g = de.provenance.licensePerGeometry
  const [open, setOpen] = useState(false)
  const total = breakdown.reduce((sum, entry) => sum + entry.rowCount, 0)
  const compatible = breakdown.filter(isCompatible).reduce((sum, entry) => sum + entry.rowCount, 0)
  const sorted = [...breakdown].sort((a, b) => b.rowCount - a.rowCount)
  const licenseLabels = new Set(breakdown.map((entry) => entry.licenseLabel))
  const singleLicenseLabel = licenseLabels.size === 1 ? [...licenseLabels][0] : undefined

  useEffect(
    function openAndScrollToHash() {
      let timers: number[] = []
      const syncWithHash = () => {
        if (window.location.hash !== LICENSE_SECTION_HASH) return
        setOpen(true)
        // The virtualized table above settles its row heights while rendering; scroll again after it.
        timers.forEach((id) => window.clearTimeout(id))
        timers = [0, 150, 500].map((delay) =>
          window.setTimeout(() => sectionRef.current?.scrollIntoView({ block: 'start' }), delay),
        )
      }
      syncWithHash()
      window.addEventListener('hashchange', syncWithHash)
      return function stopHashSync() {
        window.removeEventListener('hashchange', syncWithHash)
        timers.forEach((id) => window.clearTimeout(id))
      }
    },
    [sectionRef],
  )

  return (
    <div className="space-y-3 px-4 pt-4 pb-6 sm:px-6">
      <ul className="space-y-1 text-slate-300">
        <li>
          <span className="text-slate-500">{de.provenance.licenseShortNameLabel}: </span>
          {singleLicenseLabel ?? g.mixedLabel}
        </li>
        <li>
          <span className="text-slate-500">{de.provenance.osmCompatibilityLabelTitle}: </span>
          {compatibleShareLabel(compatible, total)}
        </li>
      </ul>
      <p className="text-xs text-slate-500">{g.summaryHint}</p>
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group"
      >
        <summary className="cursor-pointer text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300">
          {g.showOverview(breakdown.length)}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-slate-500">{g.overviewHint}</p>
          <div className="overflow-x-auto rounded border border-slate-700/70">
            <table className="min-w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-200">
                <tr>
                  <th className="px-3 py-2">{g.columnSource}</th>
                  <th className="px-3 py-2">{g.columnLicense}</th>
                  <th className="px-3 py-2 text-right">{g.columnAreas}</th>
                  <th className="px-3 py-2">{g.columnCompatible}</th>
                  <th className="px-3 py-2">{g.columnRule}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry) => (
                  <BreakdownRow key={entry.groupKey} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </details>
    </div>
  )
}

export function ReportLicenseCompatibilitySection({
  data,
  row,
  className = '',
}: {
  data: ComparisonForReport
  /** Feature detail: show the licence of this geometry (row licence, else dataset licence). */
  row?: ReportRow | null
  className?: string
}) {
  const licenseSectionHeading = sourceText(data.sourceKind, 'licenseSectionHeading')
  const breakdown = data.sourceMetadata?.licenseBreakdown
  const showBreakdown = row == null && breakdown != null && breakdown.length > 0
  const license = resolveRowLicense(row, data.sourceMetadata)
  const sectionRef = useRef<HTMLElement | null>(null)

  return (
    <section
      ref={sectionRef}
      id="report-licence-section"
      className={`overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 text-sm text-slate-400 shadow-sm ${className}`.trim()}
      aria-label={licenseSectionHeading}
    >
      <ProvenanceGridSectionHeader title={licenseSectionHeading} />
      <div className="border-t border-slate-700">
        {showBreakdown ? (
          <LicenseBreakdownDisclosure breakdown={breakdown} sectionRef={sectionRef} />
        ) : (
          <dl className="divide-y divide-slate-700/80">
            <ProvenanceGridRow
              asDl
              rightColumnClassName="mt-2"
              title={
                <h3 className="text-sm/6 font-medium text-slate-200">
                  <SourceTerm kind={data.sourceKind} term="dataHeading" />
                </h3>
              }
            >
              <ResolvedLicenseList license={license} sourceKind={data.sourceKind} />
            </ProvenanceGridRow>
          </dl>
        )}
      </div>
    </section>
  )
}
