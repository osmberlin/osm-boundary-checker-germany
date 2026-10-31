import { useMemo } from 'react'
import {
  addrPostcodeFeatureRowKey,
  LIVE_ROW_KEY_PROPERTY,
  liveOsmFeatureRowKey,
  type LiveRowKey,
} from '../lib/liveRowKey'
import type { AddrPostcodeFeatureCollection, LiveOsmFeatureCollection } from '../lib/postpass'
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
  liveOsmGeojson,
  addrPostcodeGeojson,
}: {
  featureKey: string
  wfsGeojson: GeoJSON.FeatureCollection | null
  liveOsmGeojson: LiveOsmFeatureCollection | null
  addrPostcodeGeojson: AddrPostcodeFeatureCollection | null
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

  const filteredLiveOsm = useMemo(
    () => filterCollection(liveOsmGeojson, hidden, liveOsmFeatureRowKey),
    [liveOsmGeojson, hidden],
  )

  const filteredAddrPostcode = useMemo(
    () => filterCollection(addrPostcodeGeojson, hidden, addrPostcodeFeatureRowKey),
    [addrPostcodeGeojson, hidden],
  )

  return {
    wfsGeojson: filteredWfs,
    liveOsmGeojson: filteredLiveOsm,
    addrPostcodeGeojson: filteredAddrPostcode,
  }
}
