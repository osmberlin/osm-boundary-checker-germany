import { Tooltip } from './Tooltip'

/** Small marker next to a value: green check when equal in the other source, amber ≠ when different. */
export function CompareMarker({ equal, tooltip }: { equal: boolean; tooltip: string }) {
  return (
    <Tooltip
      text={tooltip}
      as="span"
      aria-label={tooltip}
      className={`shrink-0 cursor-help items-center rounded-sm px-1 text-xs leading-5 font-semibold ${
        equal
          ? 'bg-emerald-900/45 text-emerald-300 ring-1 ring-emerald-700/60'
          : 'bg-amber-900/35 text-amber-300 ring-1 ring-amber-700/60'
      }`}
    >
      {equal ? '✓' : '≠'}
    </Tooltip>
  )
}
