import type { useNearbyOsmSearch } from '../../hooks/useLiveAreaSearches'
import { de } from '../../i18n/de'
import { formatLiveOsmError } from '../../lib/liveOsmError'
import { MAX_NEARBY_OBJECTS } from '../../lib/postpass'
import type { OverpassBoundaryTag } from '../../types/report'
import { sharedButtonClass } from '../sharedButtonStyles'

/** Bbox search of OSM boundaries around the map viewport; its results come from `useNearbyOsmSearch`. */
export type NearbyOsmSearchState = ReturnType<typeof useNearbyOsmSearch>

type Bbox = [number, number, number, number]

/**
 * "Weitere OSM-Objekte in der Umgebung suchen": runs the boundary lookup for the current map
 * viewport with one click. The found objects are rendered by the caller as candidate entries;
 * this only starts the request and shows its status.
 */
export function NearbyOsmSearch({
  search,
  getLiveQueryBbox,
  overpassBoundaryTag,
  entryCount,
}: {
  search: NearbyOsmSearchState
  getLiveQueryBbox: () => Bbox | null
  overpassBoundaryTag: OverpassBoundaryTag
  /** Number of entries the caller shows from the results (after dropping known candidates). */
  entryCount: number
}) {
  const viewportBbox = getLiveQueryBbox()

  return (
    <div className="flex flex-col items-start gap-3">
      {!viewportBbox && (
        <p className="text-sm text-amber-300/90">{de.feature.liveMapViewportPending}</p>
      )}
      <button
        type="button"
        disabled={!viewportBbox || search.isRunPending}
        onClick={() => {
          const bbox = getLiveQueryBbox()
          if (!bbox) return
          search.run({ bbox, boundaryTag: overpassBoundaryTag })
        }}
        className={sharedButtonClass}
      >
        {search.hasCachedData ? de.feature.liveOsmNearbyAgain : de.feature.liveOsmNearbySearch}
      </button>

      {search.isRunPending && <p className="text-sm text-slate-400">{de.feature.liveOsmLoading}</p>}

      {search.runError != null && !search.isRunPending && (
        <div
          className="w-full rounded-md border border-red-900/60 bg-red-950/35 px-3 py-2 text-sm text-red-100"
          role="alert"
        >
          <p className="font-medium">{de.feature.liveOsmLastErrorTitle}</p>
          <p className="mt-1 break-words whitespace-pre-wrap">
            {formatLiveOsmError(search.runError)}
          </p>
          <p className="mt-2 text-xs text-red-200/85">{de.feature.liveOsmLastErrorHint}</p>
        </div>
      )}

      {search.hasCachedData && entryCount === 0 && (
        <p className="text-sm text-slate-400">{de.feature.liveOsmNearbyEmpty}</p>
      )}

      {search.hasCachedData && search.truncated && (
        <p className="text-sm text-amber-300/90">
          {de.feature.liveOsmNearbyTruncated(MAX_NEARBY_OBJECTS)}
        </p>
      )}
    </div>
  )
}
