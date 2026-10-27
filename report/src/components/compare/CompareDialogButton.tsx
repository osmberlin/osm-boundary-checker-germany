import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { de as deLocale } from 'date-fns/locale/de'
import { useState } from 'react'
import { useRecentFeatureVisits } from '../../hooks/useRecentFeatureVisits'
import { de } from '../../i18n/de'
import { isCompareSideKey, rowDisplayName, unmatchedOsmKeyForObject } from '../../lib/compareRows'
import { areaDisplayNameForId } from '../../lib/reportLookups'
import type { CandidateMatch, ComparisonForReport, ReportRow } from '../../types/report'
import {
  AppDialogActions,
  AppDialogBody,
  AppDialogDescription,
  AppDialogHeader,
  AppDialogHeaderLeadSlot,
  AppDialogHeaderSeparator,
  AppDialogHeaderTitleSlot,
  AppDialogTitle,
  Dialog,
} from '../ui/Dialog'

type CompareTarget = { featureKey: string; name: string; visitedAt?: number }

const ENTRY_CLASS =
  'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 hover:border-sky-600 hover:bg-slate-800'

/** Official and OSM key of a pair, whichever side the current page is. */
function pairKeys(row: ReportRow, targetKey: string): { officialKey: string; osmKey: string } {
  return row.category === 'official_only'
    ? { officialKey: row.canonicalMatchKey, osmKey: targetKey }
    : { officialKey: targetKey, osmKey: row.canonicalMatchKey }
}

function TargetLink({
  areaKey,
  row,
  target,
  onPick,
}: {
  areaKey: string
  row: ReportRow
  target: CompareTarget
  onPick: () => void
}) {
  return (
    <li>
      <Link
        to="/$areaId/compare/$officialKey/$osmKey"
        params={{ areaId: areaKey, ...pairKeys(row, target.featureKey) }}
        onClick={onPick}
        className={ENTRY_CLASS}
      >
        <span className="min-w-0">
          {target.name}{' '}
          <span className="font-mono text-xs text-slate-400">{target.featureKey}</span>
        </span>
        {target.visitedAt ? (
          <span className="text-xs text-slate-400">
            {formatDistanceToNow(target.visitedAt, { locale: deLocale, addSuffix: true })}
          </span>
        ) : null}
      </Link>
    </li>
  )
}

function TargetList({
  areaKey,
  row,
  targets,
  onPick,
}: {
  areaKey: string
  row: ReportRow
  targets: CompareTarget[]
  onPick: () => void
}) {
  return (
    <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
      {targets.map((target) => (
        <TargetLink
          key={target.featureKey}
          areaKey={areaKey}
          row={row}
          target={target}
          onPick={onPick}
        />
      ))}
    </ul>
  )
}

/**
 * Suggested and recent targets. Mounted only while the dialog is open, so the stored visits are
 * read then and not on every render of the detail page.
 */
function CompareTargets({
  areaKey,
  row,
  comparison,
  candidates,
  onPick,
}: {
  areaKey: string
  row: ReportRow
  comparison: ComparisonForReport
  candidates: CandidateMatch[] | undefined
  onPick: () => void
}) {
  const visits = useRecentFeatureVisits()
  const isOfficialSide = row.category === 'official_only'
  const wantedCategory = isOfficialSide ? 'unmatched_osm' : 'official_only'
  const suggested: CompareTarget[] = isOfficialSide
    ? (candidates ?? []).flatMap((candidate) => {
        const key = unmatchedOsmKeyForObject(comparison, candidate.osmType, candidate.osmId)
        return key ? [{ featureKey: key, name: candidate.name ?? key }] : []
      })
    : []
  const suggestedKeys = new Set(suggested.map((target) => target.featureKey))
  const recent: CompareTarget[] = visits
    .filter(
      (visit) =>
        visit.areaId === areaKey &&
        visit.category === wantedCategory &&
        visit.featureKey !== row.canonicalMatchKey &&
        !suggestedKeys.has(visit.featureKey) &&
        // A row can be matched by a later nightly run; drop it then.
        isCompareSideKey(comparison, wantedCategory, visit.featureKey),
    )
    .map((visit) => ({
      featureKey: visit.featureKey,
      name: visit.name,
      visitedAt: visit.visitedAt,
    }))

  return (
    <>
      {suggested.length > 0 ? (
        <div>
          <p className="m-0 text-xs font-medium tracking-wide text-slate-400 uppercase">
            {de.compare.dialogSuggested}
          </p>
          <p className="m-0 mt-1 text-xs text-slate-400">{de.compare.dialogSuggestedHint}</p>
          <TargetList areaKey={areaKey} row={row} targets={suggested} onPick={onPick} />
        </div>
      ) : null}
      <div>
        <p className="m-0 text-xs font-medium tracking-wide text-slate-400 uppercase">
          {de.compare.dialogRecent}
        </p>
        <p className="m-0 mt-1 text-xs leading-5 text-slate-400">
          {de.compare.dialogRecentHint(areaDisplayNameForId(areaKey))}
        </p>
        {recent.length > 0 ? (
          <TargetList areaKey={areaKey} row={row} targets={recent} onPick={onPick} />
        ) : (
          <p className="m-0 mt-2 text-sm text-slate-300">{de.compare.dialogRecentEmpty}</p>
        )}
      </div>
    </>
  )
}

/**
 * "Vergleichen" next to the title of a detail page without a match. The dialog offers the other
 * side of a comparison in the same dataset: the pipeline candidates (official-only pages) and the
 * detail pages opened in this browser during the last hours.
 */
export function CompareDialogButton({
  areaKey,
  row,
  comparison,
  candidates,
  className,
}: {
  areaKey: string
  row: ReportRow
  /** Full comparison table of the dataset (with `unmatchedOsm`); undefined while it loads. */
  comparison: ComparisonForReport | undefined
  candidates?: CandidateMatch[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (row.category !== 'official_only' && row.category !== 'unmatched_osm') return null
  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'shrink-0 text-xs font-medium text-sky-400 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-300'
        }
      >
        {de.compare.buttonLabel}
      </button>

      <Dialog open={open} onClose={setOpen} size="lg">
        <AppDialogHeader>
          <AppDialogHeaderTitleSlot>
            <AppDialogTitle>{de.compare.dialogTitle}</AppDialogTitle>
          </AppDialogHeaderTitleSlot>
          <AppDialogHeaderSeparator />
          <AppDialogHeaderLeadSlot>
            <AppDialogDescription>
              {row.category === 'official_only'
                ? de.compare.dialogLeadOfficial(areaDisplayNameForId(areaKey))
                : de.compare.dialogLeadOsm(areaDisplayNameForId(areaKey))}
            </AppDialogDescription>
          </AppDialogHeaderLeadSlot>
        </AppDialogHeader>
        <AppDialogBody className="space-y-5">
          <div>
            <p className="m-0 text-xs font-medium tracking-wide text-slate-400 uppercase">
              {de.compare.dialogCurrent}
            </p>
            <p className="m-0 mt-1 text-sm text-slate-100">
              {rowDisplayName(row)}{' '}
              <span className="font-mono text-xs text-slate-400">{row.canonicalMatchKey}</span>
            </p>
          </div>
          {!open ? null : comparison ? (
            <CompareTargets
              areaKey={areaKey}
              row={row}
              comparison={comparison}
              candidates={candidates}
              onPick={close}
            />
          ) : (
            <p className="m-0 text-sm text-slate-300">{de.compare.dialogLoading}</p>
          )}
        </AppDialogBody>
        <AppDialogActions>
          <button
            type="button"
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 ring-1 ring-white/10 hover:bg-slate-700"
            onClick={close}
          >
            {de.compare.dialogClose}
          </button>
        </AppDialogActions>
      </Dialog>
    </>
  )
}
