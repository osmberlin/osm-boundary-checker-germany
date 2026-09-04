import { useCallback } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { COMPARISON_MAP_ID } from '../components/map/comparisonMapConstants'
import { padMapBbox } from '../lib/wfsGetFeature'

function boundsToPaddedBbox(bounds: {
  getWest(): number
  getSouth(): number
  getEast(): number
  getNorth(): number
}): [number, number, number, number] | null {
  const west = bounds.getWest()
  const south = bounds.getSouth()
  const east = bounds.getEast()
  const north = bounds.getNorth()
  if (!(west < east && south < north)) return null
  return padMapBbox([west, south, east, north])
}

/**
 * Live WFS/Overpass bbox from the comparison map viewport only (padded like row bbox was).
 * `viewportEpoch` is bumped from Map `onLoad` / `onMoveEnd` so LiveSourceProperties re-renders.
 */
export function useLiveQueryBboxFromMap(viewportEpoch: number) {
  const mapRef = useMap()[COMPARISON_MAP_ID]

  const getLiveQueryBbox = useCallback((): [number, number, number, number] | null => {
    void viewportEpoch
    const maplibre = mapRef?.getMap()
    if (!maplibre) return null
    return boundsToPaddedBbox(maplibre.getBounds())
  }, [mapRef, viewportEpoch])

  return { getLiveQueryBbox }
}
