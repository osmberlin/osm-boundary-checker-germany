import type { ReactNode } from 'react'

/**
 * Single horizontal row of stat blocks (value on top, label below).
 * Children get equal flex width; left border between cells (not before first).
 */
export function StatBlocksRow({
  children,
  className = '',
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  className?: string
  'aria-label'?: string
}) {
  return (
    <dl
      aria-label={ariaLabel}
      className={[
        'flex min-w-0 flex-row flex-nowrap gap-x-0',
        '[&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-0',
        '[&>*]:border-white/15 [&>*]:border-l [&>*]:pl-3',
        '[&>*]:first:border-l-0 [&>*]:first:pl-0',
        '[&>*]:lg:pl-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </dl>
  )
}

/** KPI cell: large value, muted label (flex-col-reverse). */
export function StatBlock({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-y-2">
      <dt className="text-base/7 text-slate-400">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight text-pretty text-slate-100 tabular-nums sm:text-3xl">
        {value}
      </dd>
    </div>
  )
}

/**
 * Layer toggle row cell: value on top; checkbox + swatch + label below.
 */
export function LayerToggleStatBlock({
  inputId,
  checked,
  onChange,
  swatch,
  label,
  value,
  disabled = false,
}: {
  inputId: string
  checked: boolean
  onChange: (next: boolean) => void
  swatch: ReactNode
  label: string
  value: ReactNode
  disabled?: boolean
}) {
  const interactive =
    'group flex flex-col-reverse gap-y-2 transition-colors hover:bg-slate-800/60 focus-within:bg-slate-800/60'
  const inert = `flex flex-col-reverse gap-y-2 opacity-55`

  return (
    <div className={disabled ? inert : interactive} aria-disabled={disabled || undefined}>
      <dt
        className={
          `min-w-0 text-base/7 text-slate-400 transition-colors ` +
          (disabled ? `` : `group-hover:text-slate-200`)
        }
      >
        <label
          htmlFor={inputId}
          className={
            `inline-flex w-full items-center gap-2 ` +
            (disabled ? `cursor-default` : `cursor-pointer`)
          }
        >
          <input
            id={inputId}
            type="checkbox"
            disabled={disabled}
            className={
              `size-4 shrink-0 rounded border-slate-500 bg-slate-800 text-sky-600 focus:ring-sky-500 ` +
              (disabled ? `cursor-not-allowed opacity-60` : ``)
            }
            checked={checked}
            onChange={(e) => {
              if (disabled) return
              onChange(e.target.checked)
            }}
          />
          <span className="text-sm leading-snug">{label}</span>
        </label>
      </dt>
      <dd
        className={
          `text-2xl font-semibold tracking-tight text-pretty text-slate-100 tabular-nums sm:text-3xl ` +
          (disabled ? `` : `transition-colors group-hover:text-white`)
        }
      >
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-2 ${disabled ? `cursor-default` : `cursor-pointer`}`}
        >
          <span className="inline-flex shrink-0 items-center">{swatch}</span>
          {value}
        </label>
      </dd>
    </div>
  )
}

/** Empty fourth column; inherits cell layout from `StatBlocksRow` parent. */
export function StatRowSpacer() {
  return <div aria-hidden />
}
