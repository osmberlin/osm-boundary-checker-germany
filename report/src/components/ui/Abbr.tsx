import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/** Semantic abbreviation with a dotted underline and a help cursor; `title` is the expansion. */
export function Abbr({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <abbr
      title={title}
      className={cn('cursor-help underline decoration-dotted underline-offset-2', className)}
    >
      {children}
    </abbr>
  )
}
