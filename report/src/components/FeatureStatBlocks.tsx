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

/** KPI cell: label on top, large value underneath (optional unit). */
export function StatBlock({
  label,
  value,
  unit,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-y-1">
      <dt className="text-sm leading-snug font-medium text-pretty text-slate-400">{label}</dt>
      <dd className="flex items-baseline gap-x-2">
        <span className="text-2xl font-semibold tracking-tight text-pretty text-slate-100 tabular-nums sm:text-3xl">
          {value}
        </span>
        {unit ? <span className="text-sm text-slate-400">{unit}</span> : null}
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
    'group flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-sm  hover:bg-slate-800/60 hover:outline hover:outline-8 hover:outline-slate-800/60 focus-within:bg-slate-800/60 focus-within:outline focus-within:outline-8 focus-within:outline-slate-800/60'
  const inert = `flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-sm opacity-55`

  return (
    <div className={disabled ? inert : interactive} aria-disabled={disabled || undefined}>
      <dt
        className={`min-w-0 flex-1 text-sm font-medium text-slate-400 ${disabled ? `` : `transition-colors group-hover:text-slate-200`}`}
      >
        <label
          htmlFor={inputId}
          className={
            `inline-flex w-full min-w-0 items-center gap-2 ` +
            (disabled ? `cursor-default` : `cursor-pointer`)
          }
        >
          <span className="inline-flex min-w-0 items-center gap-2">
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
            <span className="min-w-0 truncate text-sm leading-snug">{label}</span>
          </span>
          <span
            className={`mr-2 ml-auto inline-flex h-4 w-8 shrink-0 items-center overflow-hidden rounded-[2px] border border-solid border-slate-500/80 ${disabled ? `text-slate-500` : `text-slate-300`}`}
            aria-hidden
          >
            {swatch}
          </span>
        </label>
      </dt>
      <dd
        className={
          `w-full flex-none text-2xl font-semibold tracking-tight text-pretty text-slate-100 tabular-nums sm:text-3xl ` +
          (disabled ? `` : `transition-colors group-hover:text-white`)
        }
      >
        <label
          htmlFor={inputId}
          className={`block w-full ${disabled ? `cursor-default` : `cursor-pointer`}`}
        >
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
