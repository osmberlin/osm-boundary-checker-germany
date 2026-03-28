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
        className="fixed inset-0 z-40 flex w-screen justify-center overflow-y-auto bg-zinc-950/50 px-2 py-2 transition duration-100 focus:outline-none data-closed:opacity-0 data-enter:ease-out data-leave:ease-in sm:px-6 sm:py-8"
      />

      <div className="fixed inset-0 z-40 w-screen overflow-y-auto pt-6 sm:pt-0">
        <div className="grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4">
          <DialogPanel
            transition
            className={cn(
              className,
              sizes[size],
              'row-start-2 w-full min-w-0 rounded-t-2xl bg-zinc-900 p-6 shadow-lg ring-1 ring-white/10 sm:mb-auto sm:rounded-2xl',
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

export function AppDialogTitle({
  className,
  ...props
}: { className?: string } & Omit<React.ComponentProps<typeof DialogTitle>, 'className'>) {
  return (
    <DialogTitle
      {...props}
      className={cn(className, 'text-balance font-semibold text-lg text-zinc-100 sm:text-base')}
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
      className={cn(className, 'mt-2 text-pretty text-sm text-zinc-400 leading-6')}
    />
  )
}

export function AppDialogBody({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props} className={cn(className, 'mt-4 space-y-3')} />
}

export function AppDialogActions({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn(
        className,
        'mt-6 flex flex-col-reverse items-stretch justify-end gap-2 sm:flex-row sm:items-center sm:justify-end',
      )}
    />
  )
}
