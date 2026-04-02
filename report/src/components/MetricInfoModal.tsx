import { useState } from 'react'
import { de } from '../i18n/de'
import { cn } from '../lib/cn'
import {
  AppDialogActions,
  AppDialogBody,
  AppDialogDescription,
  AppDialogTitle,
  Dialog,
} from './ui/Dialog'

export type MetricInfoCopy = {
  triggerAria: string
  title: string
  lead: string
  paragraphs: readonly string[]
  close: string
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

type MetricInfoButtonProps = {
  copy: MetricInfoCopy
  className?: string
  iconClassName?: string
}

export function MetricInfoButton({ copy, className, iconClassName }: MetricInfoButtonProps) {
  const [open, setOpen] = useState(false)

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

      <Dialog open={open} onClose={setOpen} size="lg">
        <AppDialogTitle>{copy.title}</AppDialogTitle>
        <AppDialogDescription>{copy.lead}</AppDialogDescription>
        <AppDialogBody>
          {copy.paragraphs.map((p) => (
            <p key={p} className="text-sm text-slate-300 leading-6">
              {p}
            </p>
          ))}
        </AppDialogBody>
        <AppDialogActions>
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 font-medium text-sm text-slate-100 shadow-sm hover:bg-slate-700"
            onClick={() => setOpen(false)}
          >
            {copy.close}
          </button>
        </AppDialogActions>
      </Dialog>
    </>
  )
}

export function HausdorffInfoButton(props: Omit<MetricInfoButtonProps, 'copy'>) {
  return <MetricInfoButton copy={de.hausdorffInfo} {...props} />
}

export function IouInfoButton(props: Omit<MetricInfoButtonProps, 'copy'>) {
  return <MetricInfoButton copy={de.iouInfo} {...props} />
}

export function AreaDeltaInfoButton(props: Omit<MetricInfoButtonProps, 'copy'>) {
  return <MetricInfoButton copy={de.areaDeltaInfo} {...props} />
}

export function SymDiffInfoButton(props: Omit<MetricInfoButtonProps, 'copy'>) {
  return <MetricInfoButton copy={de.symDiffInfo} {...props} />
}
