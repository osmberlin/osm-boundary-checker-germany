import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function DetailRow({
  label,
  children,
  labelClassName,
}: {
  label: ReactNode
  children: ReactNode
  labelClassName?: string
}) {
  return (
    <div className="px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
      <dt className={cn('text-sm font-medium text-slate-100', labelClassName)}>{label}</dt>
      <dd className="mt-1 text-sm text-slate-300 sm:col-span-2 sm:mt-0">{children}</dd>
    </div>
  )
}

export function DetailBox({
  title,
  subtitle,
  headerRight,
  children,
  id,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  headerRight?: ReactNode
  children: ReactNode
  id?: string
  className?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-24 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/40',
        className,
      )}
    >
      <div className="px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          {headerRight}
        </div>
        {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="border-t border-slate-700">
        <dl className="divide-y divide-slate-700">{children}</dl>
      </div>
    </section>
  )
}

export function statusBadgeClasses(ok: boolean) {
  return cn(
    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
    ok ? 'bg-emerald-900/50 text-emerald-100' : 'bg-red-950/60 text-red-200',
  )
}
