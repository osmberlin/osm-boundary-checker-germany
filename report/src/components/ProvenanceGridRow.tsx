import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

const ROW = 'px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6'
const RIGHT = 'mt-3 min-w-0 md:col-span-2 md:mt-0'

export type ProvenanceGridRowProps = {
  /** Left column: use an `<h3 className="text-sm/6 font-medium text-slate-200">` for parity with provenance blocks. */
  title: ReactNode
  /** Extra content in the left column after `title` (e.g. `OfficialDatasetAgeInfoLink`). */
  titleAside?: ReactNode
  /** Main body (right column, 2/3 width from `md`). */
  children: ReactNode
  /** Merged onto the row wrapper (e.g. `bg-red-950/18` for tinted dataset cards). */
  surfaceClassName?: string
  className?: string
  /** When `true`, renders `<dt>` / `<dd>` for use inside a parent `<dl>`. */
  asDl?: boolean
  leftColumnClassName?: string
  /** Merged onto the right column (e.g. `mt-2` or `space-y-4` where rows use tighter spacing than the default `mt-3`). */
  rightColumnClassName?: string
}

/**
 * Shared 1+2 column layout used in `ReportDataProvenanceFooter` and feature-detail QA sections:
 * left heading stack, right detail body.
 */
export function ProvenanceGridRow({
  title,
  titleAside,
  children,
  className,
  asDl = false,
  leftColumnClassName,
  rightColumnClassName,
  surfaceClassName,
}: ProvenanceGridRowProps) {
  const leftStack = (
    <>
      {title}
      {titleAside}
    </>
  )

  const rowClass = cn(ROW, surfaceClassName, className)

  const rightClass = cn(RIGHT, rightColumnClassName)

  if (asDl) {
    return (
      <div className={rowClass}>
        <dt className={cn('min-w-0', leftColumnClassName)}>{leftStack}</dt>
        <dd className={rightClass}>{children}</dd>
      </div>
    )
  }

  return (
    <div className={rowClass}>
      <div className={cn('min-w-0', leftColumnClassName)}>{leftStack}</div>
      <div className={rightClass}>{children}</div>
    </div>
  )
}
