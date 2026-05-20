import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

const PAD = 'px-4 py-6 sm:px-6'

export type ProvenanceGridSectionHeaderProps = {
  title: ReactNode
  /** Optional lead / actions below the `<h2>` (same padding shell as `UpdateMapInstructions` titles). */
  children?: ReactNode
  className?: string
}

/**
 * Shared top-of-section title block for bordered cards (`px-4 py-6 sm:px-6` + `h2` styling).
 */
export function ProvenanceGridSectionHeader({
  title,
  children,
  className,
}: ProvenanceGridSectionHeaderProps) {
  return (
    <div className={cn(PAD, className)}>
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      {children}
    </div>
  )
}
