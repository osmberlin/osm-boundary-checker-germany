import {
  Description,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Dialog as HeadlessDialog,
} from '@headlessui/react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const sizes = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
} as const

export function Dialog({
  size = 'lg',
  className,
  children,
  ...props
}: {
  size?: keyof typeof sizes
  className?: string
  children: ReactNode
} & Omit<React.ComponentProps<typeof HeadlessDialog>, 'as' | 'className'>) {
  return (
    <HeadlessDialog {...props}>
      <DialogBackdrop
        transition
        className="fixed inset-0 z-40 flex w-screen justify-center overflow-y-auto bg-slate-950/50 px-2 py-2 transition duration-100 focus:outline-none data-closed:opacity-0 data-enter:ease-out data-leave:ease-in sm:px-6 sm:py-8"
      />

      <div className="fixed inset-0 z-40 w-screen overflow-y-auto pt-6 sm:pt-0">
        <div className="grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4">
          <DialogPanel
            transition
            className={cn(
              className,
              sizes[size],
              'row-start-2 flex min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-t-2xl bg-slate-900 shadow-lg ring-1 ring-white/10 sm:mb-auto sm:rounded-2xl',
              'transition duration-100 will-change-transform data-closed:translate-y-3 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in sm:data-closed:translate-y-0 sm:data-closed:scale-95',
            )}
          >
            {children}
          </DialogPanel>
        </div>
      </div>
    </HeadlessDialog>
  )
}

/** Panel edge uses `ring-white/10`; internal rules use the same weight for alignment. */
const dialogRuleClass = 'border-white/10'

export function AppDialogHeader({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn('flex flex-col border-b', dialogRuleClass, className)} />
}

export function AppDialogHeaderSeparator({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} role="separator" className={cn('border-t', dialogRuleClass, className)} />
}

/** Title row: tighter top, padding below title matches lead row top (`py-3`) for even space around the separator line. */
export function AppDialogHeaderTitleSlot({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn('px-6 pt-4 pb-3', className)} />
}

/** Lead / subtitle row: equal vertical padding above and below the copy block. */
export function AppDialogHeaderLeadSlot({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn('px-6 py-3', className)} />
}

/** Header with title only (no lead): symmetric vertical padding. */
export function AppDialogHeaderTitleSolo({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn('px-6 py-4', className)} />
}

export function AppDialogTitle({
  className,
  ...props
}: { className?: string } & Omit<React.ComponentProps<typeof DialogTitle>, 'className'>) {
  return (
    <DialogTitle
      {...props}
      className={cn('text-lg font-semibold text-balance text-slate-100 sm:text-base', className)}
    />
  )
}

export function AppDialogDescription({
  className,
  ...props
}: { className?: string } & Omit<React.ComponentProps<typeof Description>, 'className'>) {
  return (
    <Description
      {...props}
      className={cn('m-0 text-sm leading-6 text-pretty text-slate-400', className)}
    />
  )
}

export function AppDialogBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn('min-w-0 space-y-3 px-6 py-4', className)} />
}

export function AppDialogActions({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn(
        'flex flex-col-reverse items-stretch justify-end gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-end',
        dialogRuleClass,
        className,
      )}
    />
  )
}
