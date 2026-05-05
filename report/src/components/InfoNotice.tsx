import { InformationCircleIcon } from '@heroicons/react/20/solid'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type Props = {
  children: ReactNode
  className?: string
  /** Optional trailing control (e.g. a link), laid out beside the message from `md` up. */
  action?: ReactNode
}

/** Information callout with icon — tinted for the app’s dark UI (no separate light theme). */
export function InfoNotice({ children, className, action }: Props) {
  return (
    <div className={cn('rounded-md border border-blue-500/25 bg-blue-500/10 p-4', className)}>
      <div className="flex">
        <div className="shrink-0">
          <InformationCircleIcon aria-hidden="true" className="size-5 text-blue-400" />
        </div>
        <div className="ml-3 min-w-0 flex-1 md:flex md:items-start md:justify-between">
          <div className="text-sm text-blue-300">{children}</div>
          {action ? <div className="mt-3 text-sm md:mt-0 md:ml-6 md:shrink-0">{action}</div> : null}
        </div>
      </div>
    </div>
  )
}
