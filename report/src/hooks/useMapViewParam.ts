import { useQueryState } from 'nuqs'
import { useCallback, useMemo } from 'react'
import type { ViewState } from 'react-map-gl/maplibre'
import {
  MAP_VIEW_QUERY_KEY,
  type MapViewQueryValue,
  mapViewQueryParamParser,
} from '../lib/mapViewQueryParam'

export function useMapViewParam() {
  const [mapView, setMapView] = useQueryState(MAP_VIEW_QUERY_KEY, mapViewQueryParamParser)

  const commitMapViewFromMap = useCallback(
    (viewState: ViewState) => {
      void setMapView({
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
