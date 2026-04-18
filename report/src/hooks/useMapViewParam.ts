import { useNavigate, useSearch } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import type { ViewState } from 'react-map-gl/maplibre'
import {
  MAP_VIEW_QUERY_KEY,
  type MapViewQueryValue,
  parseMapViewQueryValue,
  serializeMapViewQueryString,
} from '../lib/mapViewQueryParam'

export function useMapViewParam() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const mapView = parseMapViewQueryValue(search[MAP_VIEW_QUERY_KEY])

  const setMapView = useCallback(
    (next: MapViewQueryValue | null) => {
      void navigate({
        search: ((prev: Record<string, unknown>) => ({
          ...prev,
          [MAP_VIEW_QUERY_KEY]: next == null ? undefined : serializeMapViewQueryString(next),
        })) as never,
        replace: true,
      })
    },
    [navigate],
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

  return useMemo(
    () => ({
      mapView,
      setMapView,
      commitMapViewFromMap,
    }),
    [mapView, setMapView, commitMapViewFromMap],
  )
}

export type { MapViewQueryValue }
