import { Link } from '@tanstack/react-router'
import { de } from '../../i18n/de'

/** "Vergleichen" for a candidate that is an unmatched OSM row of the same dataset. */
export function CandidateCompareLink({
  areaKey,
  officialKey,
  osmKey,
  className,
}: {
  areaKey: string
  officialKey: string
  /** Key of the unmatched OSM row; null renders nothing (way, matched or unknown relation). */
  osmKey: string | null
  className: string
}) {
  if (osmKey === null) return null
  return (
    <Link
      to="/$areaId/compare/$officialKey/$osmKey"
      params={{ areaId: areaKey, officialKey, osmKey }}
      className={className}
    >
      {de.compare.openCompare}
    </Link>
  )
}
