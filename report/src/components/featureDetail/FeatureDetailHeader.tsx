import { categoryLabelDe, de } from '../../i18n/de'
import type { ReportRow } from '../../types/report'
import { DiscussDatasetButton } from '../discussion/DiscussDatasetButton'

type Props = {
  titlePrefix: string
  row: ReportRow
}

function Middot() {
  return (
    <span className="text-slate-600" aria-hidden>
      ·
    </span>
  )
}

/**
 * Title + meta (category · OSM · discuss) on one row when space allows; meta wraps below a long title.
 * Vertical spacing to the next block is handled by the parent stack (`gap-6`).
 */
export function FeatureDetailHeader({ titlePrefix, row }: Props) {
  const showCategory = row.category === 'matched'
  const showOsm = Boolean(row.osmRelationId)

  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="max-w-full min-w-0 flex-[1_1_0] text-2xl font-semibold tracking-tight text-slate-100">
          {`${titlePrefix} ${row.nameLabel}`.trim()}
        </h1>
        <div className="ml-auto flex w-fit max-w-full flex-wrap items-baseline justify-end gap-x-2 text-xs">
          {showCategory ? (
            <span className="text-slate-500">{categoryLabelDe(row.category)}</span>
          ) : null}
          {showCategory && showOsm ? <Middot /> : null}
          {showOsm ? (
            <a
              className="text-slate-400 underline decoration-slate-500/60 underline-offset-2 hover:text-slate-300"
              href={`https://www.openstreetmap.org/relation/${row.osmRelationId}`}
              target="_blank"
              rel="noreferrer"
            >
              {de.feature.osmRelation} {row.osmRelationId}
            </a>
          ) : null}
          {showCategory || showOsm ? <Middot /> : null}
          <DiscussDatasetButton className="inline shrink-0 align-baseline text-xs font-medium text-sky-400 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-300" />
        </div>
      </div>
    </header>
  )
}
