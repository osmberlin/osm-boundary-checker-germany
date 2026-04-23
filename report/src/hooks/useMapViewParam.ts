import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { ViewState } from 'react-map-gl/maplibre'
import {
  MAP_VIEW_QUERY_KEY,
  type MapViewQueryValue,
  parseMapViewQueryValue,
  roundMapViewForUrl,
  serializeMapViewQueryString,
} from '../lib/mapViewQueryParam'

function isRedundantMapViewUpdate(
  current: MapViewQueryValue | null,
  next: MapViewQueryValue | null,
): boolean {
  if (next == null) return current == null
  if (current == null) return false
  const c = roundMapViewForUrl(current)
  const n = roundMapViewForUrl(next)
  return c.zoom === n.zoom && c.latitude === n.latitude && c.longitude === n.longitude
}

export function useMapViewParam() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const mapView = parseMapViewQueryValue(search[MAP_VIEW_QUERY_KEY])

  const setMapView = useCallback(
    (next: MapViewQueryValue | null) => {
      if (isRedundantMapViewUpdate(mapView, next)) return
      void navigate({
        search: ((prev: Record<string, unknown>) => ({
          ...prev,
          [MAP_VIEW_QUERY_KEY]: next == null ? undefined : serializeMapViewQueryString(next),
        })) as never,
        replace: true,
        resetScroll: false,
      })
    },
    [mapView, navigate],
  )

  const commitMapViewFromMap = useCallback(
    (viewState: ViewState) => {
      setMapView({
        zoom: viewState.zoom,
        latitude: viewState.latitude,
        longitude: viewState.longitude,
      })
    },
    [setMapView],
  )

  return {
    mapView,
    setMapView,
    commitMapViewFromMap,
  }
}

export type { MapViewQueryValue }
