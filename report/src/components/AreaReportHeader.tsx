import type { ReactNode } from 'react'
import { de } from '../i18n/de'
import { DiscussDatasetButton } from './discussion/DiscussDatasetButton'
import { REPORT_PROVENANCE_SECTION_ID } from './ReportDataProvenanceFooter'

function Middot() {
  return (
    <span className="text-slate-600" aria-hidden>
      ·
    </span>
  )
}

const metaLinkClass =
  'text-slate-500 underline decoration-slate-500/60 underline-offset-2 transition-colors hover:text-slate-300'

type Props = {
  title: string
  /** Optional control in front of the links, e.g. the state filter. */
  filter?: ReactNode
}

/** Area title + meta (filter · licence · data source · discuss); spacing below from parent `gap-6`. */
export function AreaReportHeader({ title, filter }: Props) {
  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="max-w-full min-w-0 flex-[1_1_0] text-2xl font-semibold tracking-tight text-slate-100">
          {title}
        </h1>
        <div className="ml-auto flex w-fit max-w-full flex-wrap items-baseline justify-end gap-x-2 text-xs">
          {filter ? (
            <>
              {filter}
              <Middot />
            </>
          ) : null}
          <a href="#report-licence-section" className={metaLinkClass}>
            {de.areaHeader.licence}
          </a>
          <Middot />
          <a href={`#${REPORT_PROVENANCE_SECTION_ID}`} className={metaLinkClass}>
            {de.areaHeader.dataSource}
          </a>
          <Middot />
          <DiscussDatasetButton className="inline shrink-0 align-baseline text-xs font-medium text-sky-400 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-300" />
        </div>
      </div>
    </header>
  )
}
