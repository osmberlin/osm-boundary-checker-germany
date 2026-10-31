import { de } from '../../i18n/de'
import { renderWithAbbr } from '../../i18n/sourceVocabulary'
import {
  dtpCorrectionFormValues,
  dtpOverrideNotice,
  type DtpOverrideNotice,
} from '../../lib/dtpCorrection'
import { githubNewDtpOverrideIssueUrl } from '../../lib/githubDtpOverrideIssueUrl'
import { useDiscussPageLinkParts } from '../../lib/useDiscussPageLinkParts'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { AlertNotice } from '../AlertNotice'
import { ProvenanceGridSectionHeader } from '../ProvenanceGridSectionHeader'

/** Lines of a reviewed override: what DtP names, what we use, and why. */
function overrideNoticeLines(notice: DtpOverrideNotice): string[] {
  const c = de.feature.dtpCorrection
  const lines: string[] = []
  if (notice.impact) lines.push(c.noticeImpact[notice.impact])
  if (notice.osmRef) {
    const { reported, used } = notice.osmRef
    lines.push(reported ? c.noticeReportedOsm(reported) : c.noticeNoReportedOsm)
    if (used) lines.push(c.noticeUsedOsm(used))
    else if (reported) lines.push(c.noticeNoUsedOsm)
  }
  if (notice.wikidata) {
    const { reported, used } = notice.wikidata
    lines.push(reported ? c.noticeWikidataReported(reported, used) : c.noticeWikidataNone(used))
  }
  lines.push(c.noticeComment(notice.comment))
  return lines
}

/**
 * Detail page of a DtP row (matched or official-only): a reviewed correction of ours, when one
 * applies, and the link to suggest a correction to DtP. Nothing for other sources.
 */
export function DtpCorrectionSection({ data, row }: { data: ComparisonForReport; row: ReportRow }) {
  const { matchKey, pageUrlAbsolute } = useDiscussPageLinkParts()
  if (data.sourceKind !== 'dtp' || row.category === 'unmatched_osm' || !row.officialProperties) {
    return null
  }
  const c = de.feature.dtpCorrection
  const notice = dtpOverrideNotice(row.officialProperties)
  const issueUrl = githubNewDtpOverrideIssueUrl({
    title: matchKey,
    page: pageUrlAbsolute,
    ...dtpCorrectionFormValues(row.officialProperties),
  })

  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={c.sectionAria}
    >
      <ProvenanceGridSectionHeader title={c.heading} />
      <div className="space-y-4 border-t border-slate-700 px-4 py-6 sm:px-6">
        {notice ? (
          <AlertNotice>
            <p className="font-medium text-amber-100">{renderWithAbbr(c.noticeTitle)}</p>
            {overrideNoticeLines(notice).map((line) => (
              <p key={line} className="mt-2">
                {renderWithAbbr(line)}
              </p>
            ))}
          </AlertNotice>
        ) : null}
        <p className="text-sm text-slate-300">{renderWithAbbr(c.lead)}</p>
        <a
          href={issueUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          {renderWithAbbr(c.linkLabel)}
        </a>
      </div>
    </section>
  )
}
