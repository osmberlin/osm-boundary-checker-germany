import { metricInfoModalSectionsDe, type MetricInfoCopy } from '@compare-metrics/metricInfoCopy.ts'
import {
  areaDeltaModalDe,
  hausdorffModalDe,
  iouModalDe,
  issueIndicatorModalDe,
  meanIouModalDe,
  symDiffModalDe,
} from '@compare-metrics/modalCopyDe.ts'
import { useState } from 'react'
import { de } from '../i18n/de'
import { cn } from '../lib/cn'
import { InfoCircleIcon } from './InfoCircleIcon'
import type { MetricModalBandContext, MetricModalBandKind } from './MetricModalBandsTable'
import { MetricModalBandsSection } from './MetricModalBandsTable'
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
} from './ui/Dialog'

export type { MetricInfoCopy } from '@compare-metrics/metricInfoCopy.ts'
export type { MetricModalBandContext, MetricModalBandKind } from './MetricModalBandsTable'

function ModalSection({
  heading,
  paragraphs,
  asList,
}: {
  heading?: string | null
  paragraphs: readonly string[]
  asList?: boolean
}) {
  if (paragraphs.length === 0) return null
  return (
    <div className="space-y-3">
      {heading ? <h3 className="text-sm font-semibold text-slate-200">{heading}</h3> : null}
      {asList ? (
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-300">
          {paragraphs.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        paragraphs.map((p) => (
          <p key={p} className="text-sm leading-6 text-slate-300">
            {p}
          </p>
        ))
      )}
    </div>
  )
}

function technicalParagraphsForModal(
  copy: MetricInfoCopy,
  bandContext: MetricModalBandContext | undefined,
): readonly string[] {
  const crs = bandContext?.metricsCrs?.trim()
  if (!copy.appendMetricsCrsNote || !crs) return copy.technical
  const style = copy.metricsCrsNoteStyle ?? 'appendLabel'
  const crsParagraph =
    style === 'appendSentence'
      ? `Flächen und Schnitte werden dabei im projizierten Metrik-Koordinatensystem dieses Vergleichs ausgewertet (${crs}).`
      : de.feature.stats.footnote.metricsCrsLine(crs)
  return [...copy.technical, crsParagraph]
}

type MetricInfoButtonProps = {
  copy: MetricInfoCopy
  bandKind?: MetricModalBandKind
  bandContext?: MetricModalBandContext
  className?: string
  iconClassName?: string
}

export function MetricInfoButton({
  copy,
  bandKind,
  bandContext,
  className,
  iconClassName,
}: MetricInfoButtonProps) {
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
        <AppDialogHeader>
          <AppDialogHeaderTitleSlot>
            <AppDialogTitle>{copy.title}</AppDialogTitle>
          </AppDialogHeaderTitleSlot>
          <AppDialogHeaderSeparator />
          <AppDialogHeaderLeadSlot>
            {copy.leadBullets?.length ? (
              <AppDialogDescription as="div" className="space-y-2 [&_p]:m-0">
                <p>{copy.lead}</p>
                <ul className="list-disc space-y-1 pl-5">
                  {copy.leadBullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </AppDialogDescription>
            ) : (
              <AppDialogDescription>{copy.lead}</AppDialogDescription>
            )}
          </AppDialogHeaderLeadSlot>
        </AppDialogHeader>
        <AppDialogBody className="space-y-5">
          {bandKind ? <MetricModalBandsSection kind={bandKind} context={bandContext} /> : null}
          <ModalSection
            heading={copy.howToReadHeading ?? metricInfoModalSectionsDe.howToRead}
            paragraphs={copy.howToRead}
            asList={copy.howToReadAsList}
          />
          <ModalSection
            heading={copy.hideTechnicalHeading ? null : metricInfoModalSectionsDe.technical}
            paragraphs={technicalParagraphsForModal(copy, bandContext)}
          />
          {copy.references?.length ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-200">
                {metricInfoModalSectionsDe.references}
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                {copy.references.map((ref) => (
                  <li key={ref.href}>
                    <a
                      href={ref.href}
                      target="_blank"
                      rel="noreferrer"
                      className="underline decoration-slate-500/60 underline-offset-2 hover:text-slate-100"
                    >
                      {ref.label}
                    </a>
                    {ref.note ? (
                      <span className="text-slate-400">
                        {' '}
                        {' \u2013 '} {ref.note}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </AppDialogBody>
        <AppDialogActions>
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 shadow-sm hover:bg-slate-700"
            onClick={() => setOpen(false)}
          >
            {copy.close}
          </button>
        </AppDialogActions>
      </Dialog>
    </>
  )
}

type OmitCopy = Omit<MetricInfoButtonProps, 'copy'>

export function HausdorffInfoButton(
  props: Omit<MetricInfoButtonProps, 'copy' | 'bandKind'> & {
    bandContext?: MetricModalBandContext
  },
) {
  const { bandContext, ...rest } = props
  return <MetricInfoButton copy={hausdorffModalDe} bandContext={bandContext} {...rest} />
}

export function IouInfoButton(
  props: Omit<OmitCopy, 'bandKind'> & { bandContext?: MetricModalBandContext },
) {
  return <MetricInfoButton copy={iouModalDe} bandKind="iou" {...props} />
}

export function AreaDeltaInfoButton(
  props: Omit<OmitCopy, 'bandKind'> & { bandContext?: MetricModalBandContext },
) {
  return <MetricInfoButton copy={areaDeltaModalDe} bandKind="areaDelta" {...props} />
}

export function SymDiffInfoButton(
  props: Omit<OmitCopy, 'bandKind'> & { bandContext?: MetricModalBandContext },
) {
  return <MetricInfoButton copy={symDiffModalDe} bandKind="symDiff" {...props} />
}

export function MeanIouInfoButton(
  props: Omit<OmitCopy, 'bandKind'> & { bandContext?: MetricModalBandContext },
) {
  return <MetricInfoButton copy={meanIouModalDe} bandKind="meanIou" {...props} />
}

export function IssueIndicatorInfoButton(
  props: Omit<OmitCopy, 'bandKind'> & { bandContext?: MetricModalBandContext },
) {
  return <MetricInfoButton copy={issueIndicatorModalDe} bandKind="issueIndicator" {...props} />
}
