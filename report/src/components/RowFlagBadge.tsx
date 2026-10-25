import type { RowFlagDefinition } from '../../../scripts/shared/rowFlags.ts'
import { Abbr } from './ui/Abbr'

/** Badges for the flags of a row (config `rowFlags`); the hint is the tooltip. */
export function RowFlagBadges({
  flagIds,
  definitions,
}: {
  flagIds: readonly string[] | undefined
  definitions: readonly RowFlagDefinition[] | undefined
}) {
  const flags = definitions?.filter((definition) => flagIds?.includes(definition.id)) ?? []
  return flags.map((flag) => (
    <span
      key={flag.id}
      className="inline-flex rounded border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 align-middle text-xs font-medium text-sky-200"
    >
      <Abbr title={flag.hint} className="no-underline">
        {flag.label}
      </Abbr>
    </span>
  ))
}
