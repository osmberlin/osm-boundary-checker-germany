import { ExclamationTriangleIcon } from '@heroicons/react/20/solid'
import { Fragment } from 'react'
import { de } from '../../i18n/de'
import { renderWithAbbr } from '../../i18n/sourceVocabulary'
import {
  dtpOverrideNotice,
  osmObjectText,
  splitDataRefs,
  type DtpOverrideNotice,
} from '../../lib/dtpCorrection'
import { GITHUB_DEFAULT_BRANCH, GITHUB_REPO_ROOT } from '../../lib/githubRepo'
import { parseLiveOsmObjectRef } from '../../lib/osmObjectRef'
import { wikidataItemUrl } from '../../lib/regionalHubQuickStatements'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { ProvenanceGridRow } from '../ProvenanceGridRow'
import { LiveOsmMapButton, type LiveOsmContext } from './LiveOsmObject'

const LINK_CLASS =
  'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

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

function LineWithLinks({ line, live }: { line: string; live: LiveOsmContext | null }) {
  const matched = live && osmObjectText(live.row.osmRelationId)
  return splitDataRefs(line).map((part, index) => {
    if (part.kind === 'text') {
      return <Fragment key={index}>{renderWithAbbr(part.text)}</Fragment>
    }
    const href =
      part.kind === 'osm'
        ? `https://www.openstreetmap.org/${part.text}`
        : wikidataItemUrl(part.text)
    const object =
      part.kind === 'osm' && live && part.text !== matched ? parseLiveOsmObjectRef(part.text) : null
    return (
      <Fragment key={index}>
        <a href={href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
          {part.text}
        </a>
        {live && object ? (
          <span className="ml-2 inline-flex align-middle">
            <LiveOsmMapButton
              context={live}
              object={object}
              label={de.feature.dtpCorrection.showOnMap}
            />
          </span>
        ) : null}
      </Fragment>
    )
  })
}

/** First row of the provenance section: the reviewed correction of ours that applies to this row. */
export function DtpOverrideRow({
  row,
  data,
  liveFeatureKey,
}: {
  row: ReportRow
  data: ComparisonForReport
  /** Key of the page's live OSM loads; without it the OSM objects have no map button. */
  liveFeatureKey?: string | undefined
}) {
  const notice = dtpOverrideNotice(row.officialProperties)
  if (!notice) return null
  const c = de.feature.dtpCorrection
  const live = liveFeatureKey ? { featureKey: liveFeatureKey, row, data } : null
  const lines = overrideNoticeLines(notice)
  return (
    <ProvenanceGridRow
      asDl
      surfaceClassName="bg-amber-950/18"
      title={
        <h3 className="flex items-center gap-2 text-sm/6 font-medium text-slate-200">
          <ExclamationTriangleIcon aria-hidden="true" className="size-4 shrink-0 text-amber-400" />
          {c.noticeHeading}
        </h3>
      }
    >
      <p className="text-xs text-slate-400">
        {c.noticeTitle.before}
        <a
          href={`${GITHUB_REPO_ROOT}/blob/${GITHUB_DEFAULT_BRANCH}/data/dtp-overrides/README.md`}
          target="_blank"
          rel="noreferrer"
          className={LINK_CLASS}
        >
          {renderWithAbbr(c.noticeTitle.linkText)}
        </a>
        {c.noticeTitle.after}
      </p>
      {lines.map((line, index) => (
        <p key={line} className="mt-2 text-sm text-slate-300">
          {/* The last line is the reason: its objects repeat the lines above. */}
          <LineWithLinks line={line} live={index < lines.length - 1 ? live : null} />
        </p>
      ))}
    </ProvenanceGridRow>
  )
}
