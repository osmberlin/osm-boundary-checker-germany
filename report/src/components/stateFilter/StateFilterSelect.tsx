import { ChevronDownIcon } from '@heroicons/react/16/solid'
import {
  germanStateCodeSchema,
  germanStateName,
  type GermanStateCode,
} from '../../../../scripts/shared/germanStates.ts'
import { de } from '../../i18n/de'
import { cn } from '../../lib/cn'
import { formatDeInteger } from '../../lib/formatDe'
import { Tooltip } from '../ui/Tooltip'

/** `count` undefined: no number in the list and never disabled (home page). */
type Option = { code: GermanStateCode; name: string; count?: number }

type Props = {
  options: Option[]
  value: GermanStateCode | null
  onChange: (next: GermanStateCode | null) => void
  className?: string
}

/**
 * Quiet while unset (grey text with a chevron), loud while set (pill with ✕). A transparent native
 * `<select>` lies over the label, so the control is as wide as its text and keeps the native list.
 * States without rows stay listed but disabled, so the list never jumps between datasets.
 */
export function StateFilterSelect({ options, value, onChange, className }: Props) {
  const active = value != null
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1',
        active &&
          'rounded-full bg-sky-500/20 py-0.5 pr-1 pl-2.5 font-medium text-sky-100 ring-1 ring-sky-400/60',
        className,
      )}
    >
      <span
        className={cn(
          'relative inline-flex items-baseline gap-0.5 rounded focus-within:ring-1 focus-within:ring-sky-400',
          !active && 'text-slate-500 hover:text-slate-300',
        )}
      >
        <span
          aria-hidden
          className={cn(!active && 'underline decoration-slate-500/60 underline-offset-2')}
        >
          {value ? germanStateName(value) : de.stateFilter.all}
        </span>
        <ChevronDownIcon aria-hidden="true" className="size-3.5 shrink-0 self-center" />
        <select
          aria-label={de.stateFilter.label}
          value={value ?? ''}
          onChange={(event) => {
            const parsed = germanStateCodeSchema.safeParse(event.target.value)
            onChange(parsed.success ? parsed.data : null)
          }}
          className="absolute inset-0 cursor-pointer appearance-none opacity-0"
        >
          <option value="">{de.stateFilter.all}</option>
          {options.map((option) => (
            <option
              key={option.code}
              value={option.code}
              disabled={option.count === 0 && option.code !== value}
            >
              {option.count === undefined
                ? option.name
                : de.stateFilter.option(option.name, formatDeInteger(option.count))}
            </option>
          ))}
        </select>
      </span>
      {active ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={de.stateFilter.clear}
          title={de.stateFilter.clear}
          className="rounded-full px-1 text-sky-200 hover:bg-sky-400/20 hover:text-white"
        >
          ✕
        </button>
      ) : null}
    </span>
  )
}

/**
 * Same slot when every row lies in one Land: the Land as quiet text, the reason in the tooltip.
 */
export function StateFilterStatic({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip text={hint} as="span" aria-label={hint}>
      <span className="cursor-help text-slate-600 underline decoration-slate-600/60 decoration-dotted underline-offset-2">
        {label}
      </span>
    </Tooltip>
  )
}
