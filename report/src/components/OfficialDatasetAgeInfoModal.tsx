import { useState } from 'react'
import { de } from '../i18n/de'
import { cn } from '../lib/cn'
import { pickOfficialDatasetExtractDate } from '../lib/datasetExtractDataDates'
import { EM_DASH } from '../lib/formatDe'
import {
  formatFreshnessDisplayDe,
  formatIsoTimestampToAbsoluteDe,
} from '../lib/formatSourceDownloadedAt'
import type { SourceMetadataSide } from '../types/report'
import { AppDialogActions, AppDialogBody, AppDialogTitle, Dialog } from './ui/Dialog'

function relativeAgeLineFromIso(raw: string | undefined): string {
  const t = raw?.trim()
  if (!t) return EM_DASH
  try {
    const f = formatFreshnessDisplayDe(t)
    return f.relativeLine ?? EM_DASH
  } catch {
    return EM_DASH
  }
}

function InfoCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <title>Info</title>
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function formatDateOrDash(raw: string | undefined): string {
  if (!raw?.trim()) return EM_DASH
  return formatIsoTimestampToAbsoluteDe(raw) || EM_DASH
}

function OfficialDatasetAgeDialog({
  open,
  onClose,
  side,
}: {
  open: boolean
  onClose: (open: boolean) => void
  side: SourceMetadataSide | null | undefined
}) {
  const copy = de.feature.officialDatasetAge
  const hasMetadata = side != null
  const pick = pickOfficialDatasetExtractDate(side)

  const sourceDateValue = hasMetadata
    ? pick.sourceDateRaw
      ? formatDateOrDash(pick.sourceDateRaw)
      : de.areaReport.sourceDateUnknown
    : EM_DASH
  const checkedValue = hasMetadata ? formatDateOrDash(pick.checkedAtRaw) : EM_DASH
  const geometryFetchedValue = hasMetadata ? formatDateOrDash(pick.geometryFetchedAtRaw) : EM_DASH

  const rows: Array<{
    label: string
    absoluteDisplay: string
    isoRaw: string | undefined
    explanation: string
  }> = [
    {
      label: de.feature.datasetExtractSourceDateLabel,
      absoluteDisplay: sourceDateValue,
      isoRaw: pick.sourceDateRaw,
      explanation: copy.sourceDateExplanation,
    },
    {
      label: de.feature.datasetExtractCheckedDateLabel,
      absoluteDisplay: checkedValue,
      isoRaw: pick.checkedAtRaw,
      explanation: copy.checkedDateExplanation,
    },
    {
      label: de.feature.datasetExtractGeometryFetchedLabel,
      absoluteDisplay: geometryFetchedValue,
      isoRaw: pick.geometryFetchedAtRaw,
      explanation: copy.geometryFetchedExplanation,
    },
  ]

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <AppDialogTitle className="text-xl font-semibold tracking-tight text-slate-50">
        {copy.modalTitle}
      </AppDialogTitle>
      <AppDialogBody>
        {!hasMetadata ? (
          <p className="text-sm leading-6 text-amber-200/80">{de.areaReport.sourceDateUnknown}</p>
        ) : null}
        <div className="space-y-5">
          {rows.map((row) => {
            const relativeLine =
              hasMetadata && row.isoRaw?.trim() ? relativeAgeLineFromIso(row.isoRaw) : EM_DASH
            return (
              <section
                key={row.label}
                className="border-b border-slate-700/80 pb-5 last:border-b-0 last:pb-0"
              >
                <h3 className="text-base leading-snug font-semibold tracking-tight text-slate-50">
                  {row.label}
                </h3>
                <p className="mt-2 text-sm text-slate-100 tabular-nums">{row.absoluteDisplay}</p>
                <p className="mt-2 text-sm text-slate-300 tabular-nums">{relativeLine}</p>
                <p className="mt-2 text-xs leading-snug text-slate-400">{row.explanation}</p>
              </section>
            )
          })}
        </div>
      </AppDialogBody>
      <AppDialogActions>
        <button
          type="button"
          className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 shadow-sm hover:bg-slate-700"
          onClick={() => onClose(false)}
        >
          {copy.close}
        </button>
      </AppDialogActions>
    </Dialog>
  )
}

export function OfficialDatasetAgeInfoButton({
  side,
  className,
  iconClassName,
}: {
  side: SourceMetadataSide | null | undefined
  className?: string
  iconClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const copy = de.feature.officialDatasetAge

  return (
    <>
      <button
        type="button"
        className={cn(
          'inline-flex shrink-0 rounded-full text-slate-400 outline-offset-2 transition hover:text-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500',
          className,
        )}
        aria-label={copy.triggerAria}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <InfoCircleIcon className={cn('size-4', iconClassName)} />
      </button>
      <OfficialDatasetAgeDialog open={open} onClose={setOpen} side={side} />
    </>
  )
}

export function OfficialDatasetAgeInfoLink({
  side,
  className,
}: {
  side: SourceMetadataSide | null | undefined
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const copy = de.feature.officialDatasetAge

  return (
    <>
      <button
        type="button"
        className={cn(
          'self-start text-xs text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400',
          className,
        )}
        aria-label={copy.triggerAria}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
      >
        {copy.linkLabel}
      </button>
      <OfficialDatasetAgeDialog open={open} onClose={setOpen} side={side} />
    </>
  )
}
