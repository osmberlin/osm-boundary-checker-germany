import {
  fetchAddrPostcodes,
  fetchNearbyBoundaries,
  type AddrPostcodesResult,
  type Bbox,
  type NearbyBoundariesResult,
} from '../lib/postpass'
import type { OverpassBoundaryTag } from '../types/report'
import { useLiveBboxSearch } from './useLiveBboxSearch'

type NearbyInput = { bbox: Bbox; boundaryTag: OverpassBoundaryTag }

function searchNearby({ bbox, boundaryTag }: NearbyInput) {
  return fetchNearbyBoundaries(bbox, boundaryTag)
}

/** OSM boundaries around the map view of a detail page. */
export function useNearbyOsmSearch(featureKey: string) {
  const search = useLiveBboxSearch<NearbyBoundariesResult, NearbyInput>(
    `nearby:${featureKey}`,
    searchNearby,
  )
  return {
    hits: search.data?.hits ?? [],
    geojson: search.data?.geojson ?? null,
    truncated: search.data?.truncated ?? false,
    hasCachedData: search.data != null,
    isRunPending: search.isRunPending,
    runError: search.runError,
    run: search.run,
  }
}

/** Addresses with `addr:postcode` in the map view of a detail page. */
export function useAddrPostcodeSearch(featureKey: string) {
  const search = useLiveBboxSearch<AddrPostcodesResult, Bbox>(
    `addr-postcode:${featureKey}`,
    fetchAddrPostcodes,
  )
  return {
    hits: search.data?.hits ?? [],
    geojson: search.data?.geojson ?? null,
    truncated: search.data?.truncated ?? false,
    hasCachedData: search.data != null,
    isRunPending: search.isRunPending,
    runError: search.runError,
    run: search.run,
  }
}
