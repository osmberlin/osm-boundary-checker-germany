import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Tooltip } from './Tooltip'

/** Semantic abbreviation with a dotted underline; the expansion is shown in a tooltip. */
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
    <Tooltip text={title} as="span" aria-label={title}>
      <abbr className={cn('cursor-help underline decoration-dotted underline-offset-2', className)}>
        {children}
      </abbr>
    </Tooltip>
  )
}
