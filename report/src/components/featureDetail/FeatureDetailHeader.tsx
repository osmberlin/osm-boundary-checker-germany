import type { ReactNode } from 'react'
import type { RowFlagDefinition } from '../../../../scripts/shared/rowFlags.ts'
import { de } from '../../i18n/de'
import type { ReportRow } from '../../types/report'
import { DiscussDatasetButton } from '../discussion/DiscussDatasetButton'
import { RowFlagBadges } from '../RowFlagBadge'

type Props = {
  titlePrefix: string
  row: ReportRow
  rowFlags?: RowFlagDefinition[] | undefined
  /** Further links next to "Datensatz diskutieren" (rows without a match: "Vergleichen"). */
  actions?: ReactNode
}

/**
 * Title + discuss link on one row when space allows; meta wraps below a long title.
 * Vertical spacing to the next block is handled by the parent stack (`gap-6`).
 */
export function FeatureDetailHeader({ titlePrefix, row, rowFlags, actions }: Props) {
  const flags = rowFlags?.filter((flag) => row.flags?.includes(flag.id)) ?? []
  const detailLines = flags.flatMap((flag) => {
    const value = flag.detailProperty ? row.officialProperties?.[flag.detailProperty] : undefined
    return flag.detailLabel && typeof value === 'string' && value.trim()
      ? [{ id: flag.id, text: de.feature.rowFlagDetail(flag.detailLabel, value.trim()) }]
      : []
  })
  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="max-w-full min-w-0 flex-[1_1_0] text-2xl font-semibold tracking-tight text-slate-100">
          {`${titlePrefix} ${row.nameLabel}`.trim()}
        </h1>
        <div className="ml-auto flex w-fit max-w-full flex-wrap items-baseline justify-end gap-x-4 text-xs">
          {actions}
          <DiscussDatasetButton className="inline shrink-0 align-baseline text-xs font-medium text-sky-400 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-300" />
        </div>
      </div>
      {flags.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-300">
          <RowFlagBadges flagIds={row.flags} definitions={rowFlags} />
          {detailLines.map((line) => (
            <span key={line.id}>{line.text}</span>
          ))}
        </div>
      ) : null}
    </header>
  )
}
