import { Link } from '@tanstack/react-router'
import {
  AppDialogActions,
  AppDialogBody,
  AppDialogDescription,
  AppDialogTitle,
  Dialog,
} from '../ui/Dialog'
import { ReportCategoryPill } from '../reportCategoryStyles'
import { de, categoryLabelDe } from '../../i18n/de'
import { resolveFeatureRowMeta } from '../../lib/comparisonMapFeatureClick'
import type { ComparisonForReport } from '../../types/report'

const st = de.areaReport.stats

export function MapOverlapPickDialog({
  open,
  keys,
  areaKey,
  data,
  onClose,
}: {
  open: boolean
  keys: string[] | null
  areaKey: string
  data: ComparisonForReport
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} size="md">
      <AppDialogTitle>{st.mapOverlapPickerTitle}</AppDialogTitle>
      <AppDialogDescription>{st.mapOverlapPickerLead}</AppDialogDescription>
      <AppDialogBody>
        <ul className="list-none space-y-3 p-0">
          {(keys ?? []).map((key) => {
            const meta = resolveFeatureRowMeta(data, key)
            return (
              <li
                key={key}
                className="flex flex-col gap-2 rounded border border-slate-700/80 bg-slate-800/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {meta ? (
                    <>
                      <ReportCategoryPill category={meta.category}>
                        {categoryLabelDe(meta.category)}
                      </ReportCategoryPill>
                      <span className="text-sm font-medium text-slate-100">{meta.nameLabel}</span>
                    </>
                  ) : (
                    <span className="font-mono text-sm break-all text-slate-300">{key}</span>
                  )}
                </div>
                <Link
                  className="shrink-0 text-sm font-medium text-sky-400 underline decoration-slate-500/60 underline-offset-2 hover:text-sky-300"
                  to="/$areaId/feature/$featureKey"
                  params={{ areaId: areaKey, featureKey: key }}
                >
                  {de.areaReport.table.view}
                </Link>
              </li>
            )
          })}
        </ul>
      </AppDialogBody>
      <AppDialogActions>
        <button
          type="button"
          className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 shadow-sm hover:bg-slate-700"
          onClick={onClose}
        >
          {st.mapOverlapPickerClose}
        </button>
      </AppDialogActions>
    </Dialog>
  )
}
