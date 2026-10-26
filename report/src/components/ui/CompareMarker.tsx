import { Tooltip } from './Tooltip'

/**
 * Small marker next to a value: green check when equal in the other source, amber ≠ when different,
 * amber ∅ (`missing`) when the other source has no value at all.
 */
export function CompareMarker({
  equal,
  missing = false,
  tooltip,
}: {
  equal: boolean
  missing?: boolean
  tooltip: string
}) {
  return (
    <Tooltip
      text={tooltip}
      as="span"
      aria-label={tooltip}
      className={`inline-flex w-5 shrink-0 cursor-help items-center justify-center rounded-sm text-xs leading-5 font-semibold ${
        equal && !missing
          ? 'bg-emerald-900/45 text-emerald-300 ring-1 ring-emerald-700/60'
          : 'bg-amber-900/35 text-amber-300 ring-1 ring-amber-700/60'
      }`}
    >
      {missing ? '∅' : equal ? '✓' : '≠'}
    </Tooltip>
  )
}
