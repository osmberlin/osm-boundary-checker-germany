import type { ReactNode } from 'react'

/**
 * A value with its compare markers: the value on the left, the markers at the far right of the row
 * (top right when the value wraps). Use for every value list that shows `CompareMarker`.
 */
export function MarkedValue({ children, markers }: { children: ReactNode; markers?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-start justify-between gap-x-3">
      <span className="min-w-0 break-words">{children}</span>
      {markers ? <span className="flex shrink-0 items-start gap-1">{markers}</span> : null}
    </span>
  )
}
