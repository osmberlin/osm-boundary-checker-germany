import { useCallback, useEffect, useState } from 'react'
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
 * Re-renders after the map instance is ready so buttons can enable once `getBounds()` works.
 */
export function useLiveQueryBboxFromMap() {
  const mapRef = useMap()[COMPARISON_MAP_ID]
  const [viewportEpoch, setViewportEpoch] = useState(0)

  useEffect(() => {
    const maplibre = mapRef?.getMap()
    if (!maplibre) return

    const bump = () => setViewportEpoch((n) => n + 1)
    maplibre.on('load', bump)
    maplibre.on('moveend', bump)
    if (maplibre.loaded()) bump()

    return () => {
      maplibre.off('load', bump)
      maplibre.off('moveend', bump)
    }
  }, [mapRef])

  const getLiveQueryBbox = useCallback((): [number, number, number, number] | null => {
    void viewportEpoch
    const maplibre = mapRef?.getMap()
    if (!maplibre) return null
    return boundsToPaddedBbox(maplibre.getBounds())
  }, [mapRef, viewportEpoch])

  return { getLiveQueryBbox }
}
