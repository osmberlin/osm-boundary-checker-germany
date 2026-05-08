import { useMemo } from 'react'
import { LIVE_ROW_KEY_PROPERTY, overpassFeatureRowKey, type LiveRowKey } from '../lib/liveRowKey'
import type { OverpassGeoJsonFeatureCollection } from '../lib/overpassBbox'
import { useHiddenLiveRowKeys } from '../stores/liveOverlayVisibilityStore'

function filterCollection<TCollection extends { features: TFeature[] }, TFeature>(
  collection: TCollection | null,
  hidden: ReadonlySet<LiveRowKey>,
  rowKeyOf: (feature: TFeature) => LiveRowKey | null,
): TCollection | null {
  if (!collection) return null
  if (hidden.size === 0) return collection
  const features = collection.features.filter((feature) => {
    const key = rowKeyOf(feature)
    return key == null ? true : !hidden.has(key)
  })
  if (features.length === collection.features.length) return collection
  return { ...collection, features }
}

/**
 * Returns the live overlay GeoJSON with hidden rows filtered out so the map only
 * draws areas whose result disclosure is currently open.
 *
 * Subscribes to the visibility store via an atomic selector — no prop drilling.
 */
export function useFilteredLiveOverlays({
  featureKey,
  wfsGeojson,
  overpassGeojson,
}: {
  featureKey: string
  wfsGeojson: GeoJSON.FeatureCollection | null
  overpassGeojson: OverpassGeoJsonFeatureCollection | null
}) {
  const hidden = useHiddenLiveRowKeys(featureKey)

  const filteredWfs = useMemo(
    () =>
      filterCollection<GeoJSON.FeatureCollection, GeoJSON.Feature>(
        wfsGeojson,
        hidden,
        (feature) => {
          const key = feature.properties?.[LIVE_ROW_KEY_PROPERTY]
          return typeof key === 'string' ? key : null
        },
      ),
    [wfsGeojson, hidden],
  )

  const filteredOverpass = useMemo(
    () => filterCollection(overpassGeojson, hidden, overpassFeatureRowKey),
    [overpassGeojson, hidden],
  )

  return { wfsGeojson: filteredWfs, overpassGeojson: filteredOverpass }
}
