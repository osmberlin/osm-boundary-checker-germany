import { InformationCircleIcon } from '@heroicons/react/20/solid'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type Props = {
  children: ReactNode
  className?: string
}

/** Inline info callout (dark theme, sky accent) — reusable for snapshot / PMTiles hints. */
export function InfoNotice({ children, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-md border border-sky-500/25 bg-sky-950/35 p-4 outline outline-sky-500/15',
        className,
      )}
    >
      <div className="flex gap-3">
        <InformationCircleIcon aria-hidden="true" className="size-5 shrink-0 text-sky-400" />
        <div className="min-w-0 flex-1 text-sm text-slate-300">{children}</div>
      </div>
    </div>
  )
}
