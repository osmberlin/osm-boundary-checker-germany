import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { ChevronUpDownIcon } from '@heroicons/react/16/solid'
import { CheckIcon } from '@heroicons/react/20/solid'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { formatDeInteger } from '../lib/formatDe'
import { InfoCircleIcon } from './InfoCircleIcon'
import { Tooltip } from './ui/Tooltip'

export const LIGHT_CHECKBOX_ROW_INTERACTIVE_CLASS =
  'transition-colors hover:bg-[#E1E4DF] focus-within:bg-[#E1E4DF]'

/**
 * Light filter panel (area page, feature detail): from `sm` one row of cells with vertical
 * dividers; below `sm` a list, one cell per line with the number left of its label and light
 * horizontal dividers, so every label stays readable on a phone. Use with `narrowLayout="none"`.
 */
export const KPI_FILTER_ROW_LAYOUT = [
  'mt-0 flex min-w-0 flex-col sm:flex-row',
  '[&>*]:min-w-0 sm:[&>*]:flex-1 sm:[&>*]:basis-0',
  'max-sm:[&>*]:border-t max-sm:[&>*]:border-slate-300 max-sm:[&>*]:py-2.5',
  'max-sm:[&>*]:first:border-t-0 max-sm:[&>*]:first:pt-0 max-sm:[&>*]:last:pb-0',
  'sm:[&>*]:border-l sm:[&>*]:border-slate-500 sm:[&>*]:pl-3 lg:[&>*]:pl-6',
  'sm:[&>*]:first:border-l-0 sm:[&>*]:first:pl-0',
].join(' ')

const kpiRowDefaultLayout = [
  'flex min-w-0 flex-row flex-nowrap gap-x-0',
  '[&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-0',
  '[&>*]:border-white/15 [&>*]:border-l [&>*]:pl-3',
  '[&>*]:first:border-l-0 [&>*]:first:pl-0',
  '[&>*]:lg:pl-6',
] as const

/** Three columns then remainder: fits five home KPIs in two rows on narrow viewports. */
const kpiRowNarrowGridLayout = [
  'grid min-w-0 grid-cols-3 gap-x-3 gap-y-4',
  '[&>*]:min-w-0',
  'md:flex md:flex-row md:flex-nowrap md:gap-x-0 md:gap-y-0',
  'md:[&>*]:flex-1 md:[&>*]:basis-0',
  'md:[&>*]:border-white/15 md:[&>*]:border-l md:[&>*]:pl-3',
  'md:[&>*]:first:border-l-0 md:[&>*]:first:pl-0',
  'md:[&>*]:lg:pl-6',
] as const

/**
 * Single horizontal row of stat blocks (label on top, value below).
 * Children get equal flex width; left border between cells (not before first).
 * Use `narrowLayout="gridThreeTwoRows"` for a 3+2 grid below the `md` breakpoint.
 * Use `narrowLayout="none"` when `className` fully defines layout (e.g. responsive grid + borders).
 */
export function KpiRow({
  children,
  className = '',
  'aria-label': ariaLabel,
  narrowLayout = 'default',
}: {
  children: ReactNode
  className?: string
  'aria-label'?: string
  narrowLayout?: 'default' | 'gridThreeTwoRows' | 'none'
}) {
  const layoutClasses =
    narrowLayout === 'none'
      ? (['min-w-0'] as const)
      : narrowLayout === 'gridThreeTwoRows'
        ? kpiRowNarrowGridLayout
        : kpiRowDefaultLayout

  return (
    <dl aria-label={ariaLabel} className={[...layoutClasses, className].filter(Boolean).join(' ')}>
      {children}
    </dl>
  )
}

/** Shared bordered wrapper used around stat/filter rows. */
export function KpiSection({
  children,
  className = '',
  'aria-label': ariaLabel,
}: {
  children: ReactNode
  className?: string
  'aria-label'?: string
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={[
        'overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 p-5 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </section>
  )
}

/**
 * {@link KpiSection} with exactly one {@link KpiRow}; use instead of nesting those two.
 */
export function KpiSectionRow({
  children,
  className = '',
  rowClassName = '',
  'aria-label': ariaLabel,
  narrowLayout,
}: {
  children: ReactNode
  className?: string
  rowClassName?: string
  'aria-label'?: string
  narrowLayout?: 'default' | 'gridThreeTwoRows' | 'none'
}) {
  return (
    <KpiSection className={className} aria-label={ariaLabel}>
      <KpiRow className={rowClassName} narrowLayout={narrowLayout}>
        {children}
      </KpiRow>
    </KpiSection>
  )
}

/** KPI cell: label on top, large value underneath (optional unit). */
export function KpiCell({
  label,
  value,
  unit,
  hint,
}: {
  label: ReactNode
  value: ReactNode
  unit?: ReactNode
  hint?: ReactNode
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
      {hint ? (
        <dd className="m-0 text-xs leading-snug text-pretty text-slate-500">{hint}</dd>
      ) : null}
    </div>
  )
}

/**
 * Layer toggle row cell: value on top; checkbox + swatch + label below.
 */
export function KpiToggleCell({
  inputId,
  checked,
  onChange,
  swatch,
  label,
  value,
  disabled = false,
  labelExtra,
}: {
  inputId: string
  checked: boolean
  onChange: (next: boolean) => void
  swatch: ReactNode
  label: ReactNode
  value: ReactNode
  disabled?: boolean
  /** Optional trailing content after the label (e.g. map zoom hint). */
  labelExtra?: ReactNode
}) {
  const interactive = `group flex flex-wrap max-sm:flex-nowrap items-center justify-between gap-x-4 gap-y-2 rounded-none ring-0 ${LIGHT_CHECKBOX_ROW_INTERACTIVE_CLASS} hover:ring-4 hover:ring-[#E1E4DF] focus-within:ring-4 focus-within:ring-[#E1E4DF]`
  const inert = `flex flex-wrap max-sm:flex-nowrap items-center justify-between gap-x-4 gap-y-2 rounded-none opacity-55`

  return (
    <div className={disabled ? inert : interactive} aria-disabled={disabled || undefined}>
      <dd
        className={
          `w-full flex-none text-2xl font-semibold tracking-tight text-pretty text-slate-900 tabular-nums max-sm:w-auto max-sm:min-w-20 max-sm:shrink-0 sm:text-3xl ` +
          (disabled ? `` : `transition-colors group-hover:text-slate-950`)
        }
      >
        <label
          htmlFor={inputId}
          className={`inline-flex w-full items-center gap-2 ${disabled ? `cursor-default` : `cursor-pointer`}`}
        >
          {value}
        </label>
      </dd>
      <dt
        className={`min-w-0 flex-1 text-sm font-medium text-slate-700 ${disabled ? `` : `transition-colors group-hover:text-slate-900`}`}
      >
        <label
          htmlFor={inputId}
          className={
            `inline-flex w-full min-w-0 items-center justify-between gap-2 ` +
            (disabled ? `cursor-default` : `cursor-pointer`)
          }
        >
          <span className="inline-flex min-w-0 items-center gap-2">
            <input
              id={inputId}
              type="checkbox"
              disabled={disabled}
              className={
                `size-4 shrink-0 rounded border-slate-500 bg-white text-sky-700 focus:ring-sky-500 ` +
                (disabled ? `cursor-not-allowed opacity-60` : ``)
              }
              checked={checked}
              onChange={(e) => {
                if (disabled) return
                onChange(e.target.checked)
              }}
            />
            {/* Below `sm` the extra hint goes under the label, so the label keeps its width. */}
            <span className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="min-w-0 truncate text-sm leading-snug">{label}</span>
              {labelExtra != null ? (
                <span className="shrink-0 text-xs font-normal whitespace-nowrap">{labelExtra}</span>
              ) : null}
            </span>
          </span>
          <span className="mr-2 inline-flex w-10 shrink-0 justify-end" aria-hidden>
            {swatch}
          </span>
        </label>
      </dt>
    </div>
  )
}

/**
 * KPI cell whose label line is a dropdown that filters the table (Tailwind Plus „Select Menus /
 * With secondary text“). The number is the row count of the selected option; the list shows the
 * count of every option. The button keeps its shape when a filter is set and only turns sky. The
 * explanation sits in the info tooltip.
 */
export function KpiSelectCell<T extends string>({
  options,
  selected,
  onChange,
  hint,
  ariaLabel,
}: {
  options: { value: T; label: string; count: number }[]
  selected: T
  onChange: (next: T) => void
  hint: string
  ariaLabel: string
}) {
  const current = options.find((option) => option.value === selected) ?? options[0]
  const active = current != null && current !== options[0]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 max-sm:flex-nowrap">
      <dd className="w-full flex-none text-2xl font-semibold tracking-tight text-slate-900 tabular-nums max-sm:w-auto max-sm:min-w-20 max-sm:shrink-0 sm:text-3xl">
        {current ? formatDeInteger(current.count) : null}
      </dd>
      <dt className="flex min-w-0 flex-1 items-center gap-1.5">
        <Listbox value={selected} onChange={onChange}>
          <ListboxButton
            aria-label={ariaLabel}
            className={cn(
              'inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-sm font-medium outline-1 -outline-offset-1 focus-visible:outline-2 focus-visible:outline-sky-600',
              active
                ? 'bg-sky-50 text-sky-900 outline-sky-600 hover:bg-sky-100'
                : 'bg-white text-slate-800 outline-slate-400 hover:bg-slate-50',
            )}
          >
            <span className="truncate">{current?.label}</span>
            <ChevronUpDownIcon
              aria-hidden="true"
              className={cn('size-4 shrink-0', active ? 'text-sky-700' : 'text-slate-500')}
            />
          </ListboxButton>
          <ListboxOptions
            anchor="bottom start"
            transition
            className="z-20 w-64 rounded-md bg-white py-1 text-sm shadow-lg outline-1 outline-black/5 [--anchor-gap:4px] data-closed:opacity-0 data-leave:transition data-leave:duration-100 data-leave:ease-in"
          >
            {options.map((option) => (
              <ListboxOption
                key={option.value}
                value={option.value}
                className="group relative flex cursor-pointer gap-2 py-2 pr-9 pl-3 text-slate-900 select-none data-focus:bg-sky-700 data-focus:text-white"
              >
                <span className="truncate group-data-selected:font-semibold">{option.label}</span>
                <span className="ml-auto text-slate-500 tabular-nums group-data-focus:text-sky-100">
                  {formatDeInteger(option.count)}
                </span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-sky-700 group-not-data-selected:hidden group-data-focus:text-white">
                  <CheckIcon aria-hidden="true" className="size-4" />
                </span>
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Listbox>
        <Tooltip text={hint} as="span" aria-label={hint}>
          <InfoCircleIcon className="size-4 shrink-0 cursor-help text-slate-500 hover:text-slate-700" />
        </Tooltip>
      </dt>
    </div>
  )
}

/** Empty fourth column; inherits cell layout from `KpiRow` parent. */
export function KpiRowSpacer() {
  return <div aria-hidden />
}
