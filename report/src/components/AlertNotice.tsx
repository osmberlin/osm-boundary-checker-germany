import { ExclamationTriangleIcon } from '@heroicons/react/20/solid'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'

type Props = {
  children: ReactNode
  className?: string
  action?: ReactNode
}

/** Warning callout for outdated / archived-only data (dark UI). */
export function AlertNotice({ children, className, action }: Props) {
  return (
    <div className={cn('rounded-md border border-amber-500/35 bg-amber-500/10 p-4', className)}>
      <div className="flex">
        <div className="shrink-0">
          <ExclamationTriangleIcon aria-hidden="true" className="size-5 text-amber-400" />
        </div>
        <div className="ml-3 min-w-0 flex-1 md:flex md:items-start md:justify-between">
          <div className="text-sm text-amber-200">{children}</div>
          {action ? <div className="mt-3 text-sm md:mt-0 md:ml-6 md:shrink-0">{action}</div> : null}
        </div>
      </div>
    </div>
  )
}
