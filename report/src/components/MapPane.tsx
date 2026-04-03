import maplibregl from 'maplibre-gl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ViewState, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import MapLibre, { type MapRef } from 'react-map-gl/maplibre'
import { type MapViewQueryValue, serializeMapViewQueryString } from '../lib/mapViewQueryParam'
import {
  COMPARISON_BASEMAP_STYLE,
  COMPARISON_INTERACTIVE_LAYER_IDS,
} from './map/comparisonMapConstants'
import {
  featureIdFilterExpr,
  filterOfficialDiff,
  filterOfficialOverlay,
  filterOsmDiff,
  filterOsmOverlay,
} from './map/comparisonMapFilters'
import { ComparisonVectorLayers } from './map/ComparisonVectorLayers'
import 'maplibre-gl/dist/maplibre-gl.css'

export default function MapPane({
  pmtilesUrl,
  sourceLayer,
  featureId,
  allowedFeatureIds = null,
  mapBbox,
  urlMapView,
  onMoveEndCommitUrl,
  showOfficial,
  showOsm,
  showDiff,
  onFeatureClick,
  mapId,
  onZoomChange,
}: {
  pmtilesUrl: string
  sourceLayer: string
  /** Single-feature view; use `null` to show all features (overview). */
  featureId: string | null
  /**
   * When `featureId` is `null`, optionally restrict to these keys.
   * `null`: no restriction. `[]`: nothing visible.
   */
  allowedFeatureIds?: string[] | null
  mapBbox: [number, number, number, number] | null
  urlMapView: MapViewQueryValue | null
  onMoveEndCommitUrl: (viewState: ViewState) => void
  showOfficial: boolean
  showOsm: boolean
  showDiff: boolean
  /** Overview: navigate to feature detail when clicking a polygon. */
  onFeatureClick?: (featureKey: string) => void
  /**
   * When set (e.g. via ComparisonMapShell), registers this map with MapProvider for `useMap()[mapId]`.
   * @see https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/map#mapprovider
   */
  mapId?: string
  /** Optional callback for zoom-aware UI hints outside the map component. */
  onZoomChange?: (zoom: number) => void
}) {
  const mapRef = useRef<MapRef>(null)
  const skipNextMoveEndCommitRef = useRef(false)
  const lastCommittedMapSerializationRef = useRef<string | null>(
    urlMapView ? serializeMapViewQueryString(urlMapView) : null,
  )
  const [mapReady, setMapReady] = useState(false)

  const featureIdExpr = useMemo(
    () => featureIdFilterExpr(featureId, allowedFeatureIds ?? null),
    [featureId, allowedFeatureIds],
  )

  const filterOfficialOverlayExpr = useMemo(
    () => filterOfficialOverlay(featureIdExpr),
    [featureIdExpr],
  )
  const filterOsmOverlayExpr = useMemo(() => filterOsmOverlay(featureIdExpr), [featureIdExpr])
  const filterOfficialDiffExpr = useMemo(() => filterOfficialDiff(featureIdExpr), [featureIdExpr])
  const filterOsmDiffExpr = useMemo(() => filterOsmDiff(featureIdExpr), [featureIdExpr])

  const mid = useMemo(() => {
    if (mapBbox) {
      const [w, s, e, n] = mapBbox
      return [(w + e) / 2, (s + n) / 2] as [number, number]
    }
    return [13.4, 52.52] as [number, number]
  }, [mapBbox])

  const initialViewState = useMemo(
    () =>
      urlMapView
        ? {
            longitude: urlMapView.longitude,
            latitude: urlMapView.latitude,
            zoom: urlMapView.zoom,
          }
        : {
            longitude: mid[0],
            latitude: mid[1],
            zoom: 10,
          },
    [urlMapView, mid],
  )

  const onLoad = useCallback(
    (e: { target: maplibregl.Map }) => {
      setMapReady(true)
      onZoomChange?.(e.target.getZoom())
      if (urlMapView) return
      if (!mapBbox) return
      const [w, s, east, n] = mapBbox
      if (w < east && s < n) {
        skipNextMoveEndCommitRef.current = true
        e.target.fitBounds(
          [
            [w, s],
            [east, n],
          ],
          { padding: 40, duration: 0 },
        )
      }
    },
    [urlMapView, mapBbox, onZoomChange],
  )

  const onMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      if (skipNextMoveEndCommitRef.current) {
        skipNextMoveEndCommitRef.current = false
        return
      }
      const s = serializeMapViewQueryString(e.viewState)
      lastCommittedMapSerializationRef.current = s
      onZoomChange?.(e.viewState.zoom)
      onMoveEndCommitUrl(e.viewState)
    },
    [onMoveEndCommitUrl, onZoomChange],
  )

  const onMapClick = useCallback(
    (e: { features?: GeoJSON.Feature[] }) => {
      if (!onFeatureClick) return
      const fs = e.features
      if (!fs?.length) return
      for (const f of fs) {
        const props = f.properties as Record<string, unknown> | null
        const id = props?.featureId
        if (typeof id === 'string' && id.length > 0) {
          onFeatureClick(id)
          break
        }
      }
    },
    [onFeatureClick],
  )

  useEffect(() => {
    if (!mapReady) return

    const serialized = urlMapView ? serializeMapViewQueryString(urlMapView) : null

    if (serialized === lastCommittedMapSerializationRef.current) return

    const map = mapRef.current?.getMap()
    if (!urlMapView) {
      lastCommittedMapSerializationRef.current = serialized
      return
    }
    if (!map) return

    map.jumpTo({
      center: [urlMapView.longitude, urlMapView.latitude],
      zoom: urlMapView.zoom,
    })
    lastCommittedMapSerializationRef.current = serialized
  }, [urlMapView, mapReady])

  return (
    <MapLibre
      ref={mapRef}
      id={mapId}
      mapLib={maplibregl}
      initialViewState={initialViewState}
      style={{
        width: '100%',
        height: '100%',
        cursor: onFeatureClick ? 'pointer' : undefined,
      }}
      mapStyle={COMPARISON_BASEMAP_STYLE}
      onLoad={onLoad}
      onMoveEnd={onMoveEnd}
      onClick={onFeatureClick ? onMapClick : undefined}
      interactiveLayerIds={onFeatureClick ? [...COMPARISON_INTERACTIVE_LAYER_IDS] : undefined}
    >
      <ComparisonVectorLayers
        pmtilesUrl={pmtilesUrl}
        sourceLayer={sourceLayer}
        filterOfficialOverlay={filterOfficialOverlayExpr}
        filterOsmOverlay={filterOsmOverlayExpr}
        filterOfficialDiff={filterOfficialDiffExpr}
        filterOsmDiff={filterOsmDiffExpr}
        showOfficial={showOfficial}
        showOsm={showOsm}
        showDiff={showDiff}
      />
    </MapLibre>
  )
}
