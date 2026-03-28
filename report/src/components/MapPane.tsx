import type { ExpressionSpecification } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ViewState, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import MapLibre, { Layer, type MapRef, Source } from 'react-map-gl/maplibre'
import { type MapViewQueryValue, serializeMapViewQueryString } from '../lib/mapViewQueryParam'
import { mapLayerColors } from './mapLayerColors'
import 'maplibre-gl/dist/maplibre-gl.css'

/** OpenFreeMap — Positron (light), no API key. https://openfreemap.org/quick_start */
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

const SOURCE_ID = 'comparison-pmtiles'

const COMPARISON_INTERACTIVE_LAYER_IDS = [
  `${SOURCE_ID}-overlay-official-fill`,
  `${SOURCE_ID}-overlay-official-line`,
  `${SOURCE_ID}-overlay-osm-fill`,
  `${SOURCE_ID}-overlay-osm-line`,
  `${SOURCE_ID}-diff-official-fill`,
  `${SOURCE_ID}-diff-official-line`,
  `${SOURCE_ID}-diff-osm-fill`,
  `${SOURCE_ID}-diff-osm-line`,
] as const

/** Tiles without `mapRole` are treated as overlay (older PMTiles). */
const OVERLAY_ROLE_FILTER = [
  'any',
  ['==', ['get', 'mapRole'], 'overlay'],
  ['!', ['has', 'mapRole']],
] as ExpressionSpecification

function featureIdFilterExpr(
  featureIdFocus: string | null,
  allowedFeatureIds: string[] | null,
): ExpressionSpecification | null {
  if (featureIdFocus !== null) {
    return ['==', ['get', 'featureId'], featureIdFocus]
  }
  if (allowedFeatureIds !== null) {
    if (allowedFeatureIds.length === 0) {
      return ['==', 1, 0] as ExpressionSpecification
    }
    return ['in', ['get', 'featureId'], ['literal', allowedFeatureIds]] as ExpressionSpecification
  }
  return null
}

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

  const filterOfficialOverlay = useMemo((): ExpressionSpecification => {
    const parts: ExpressionSpecification[] = [
      OVERLAY_ROLE_FILTER,
      ['==', ['get', 'boundarySource'], 'external'],
    ]
    if (featureIdExpr) parts.unshift(featureIdExpr)
    return ['all', ...parts]
  }, [featureIdExpr])

  const filterOsmOverlay = useMemo((): ExpressionSpecification => {
    const parts: ExpressionSpecification[] = [
      OVERLAY_ROLE_FILTER,
      ['==', ['get', 'boundarySource'], 'osm'],
    ]
    if (featureIdExpr) parts.unshift(featureIdExpr)
    return ['all', ...parts]
  }, [featureIdExpr])

  const filterOfficialDiff = useMemo((): ExpressionSpecification => {
    const parts: ExpressionSpecification[] = [
      ['==', ['get', 'mapRole'], 'diff'],
      ['==', ['get', 'boundarySource'], 'external'],
    ]
    if (featureIdExpr) parts.unshift(featureIdExpr)
    return ['all', ...parts]
  }, [featureIdExpr])

  const filterOsmDiff = useMemo((): ExpressionSpecification => {
    const parts: ExpressionSpecification[] = [
      ['==', ['get', 'mapRole'], 'diff'],
      ['==', ['get', 'boundarySource'], 'osm'],
    ]
    if (featureIdExpr) parts.unshift(featureIdExpr)
    return ['all', ...parts]
  }, [featureIdExpr])

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
    [urlMapView, mapBbox],
  )

  const onMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      if (skipNextMoveEndCommitRef.current) {
        skipNextMoveEndCommitRef.current = false
        return
      }
      const s = serializeMapViewQueryString(e.viewState)
      lastCommittedMapSerializationRef.current = s
      onMoveEndCommitUrl(e.viewState)
    },
    [onMoveEndCommitUrl],
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

  const o = mapLayerColors.official
  const s = mapLayerColors.osm
  const d = mapLayerColors.diff

  return (
    <MapLibre
      ref={mapRef}
      mapLib={maplibregl}
      initialViewState={initialViewState}
      style={{
        width: '100%',
        height: '100%',
        cursor: onFeatureClick ? 'pointer' : undefined,
      }}
      mapStyle={BASEMAP_STYLE}
      onLoad={onLoad}
      onMoveEnd={onMoveEnd}
      onClick={onFeatureClick ? onMapClick : undefined}
      interactiveLayerIds={onFeatureClick ? [...COMPARISON_INTERACTIVE_LAYER_IDS] : undefined}
    >
      <Source id={SOURCE_ID} type="vector" url={pmtilesUrl}>
        <Layer
          id={`${SOURCE_ID}-overlay-official-fill`}
          type="fill"
          source={SOURCE_ID}
          source-layer={sourceLayer}
          filter={filterOfficialOverlay}
          layout={{ visibility: showOfficial ? 'visible' : 'none' }}
          paint={{
            'fill-color': o.fill,
            'fill-opacity': o.fillOpacity,
          }}
        />
        <Layer
          id={`${SOURCE_ID}-overlay-official-line`}
          type="line"
          source={SOURCE_ID}
          source-layer={sourceLayer}
          filter={filterOfficialOverlay}
          layout={{ visibility: showOfficial ? 'visible' : 'none' }}
          paint={{
            'line-color': o.line,
            'line-width': 2,
          }}
        />
        <Layer
          id={`${SOURCE_ID}-overlay-osm-fill`}
          type="fill"
          source={SOURCE_ID}
          source-layer={sourceLayer}
          filter={filterOsmOverlay}
          layout={{ visibility: showOsm ? 'visible' : 'none' }}
          paint={{
            'fill-color': s.fill,
            'fill-opacity': s.fillOpacity,
          }}
        />
        <Layer
          id={`${SOURCE_ID}-overlay-osm-line`}
          type="line"
          source={SOURCE_ID}
          source-layer={sourceLayer}
          filter={filterOsmOverlay}
          layout={{ visibility: showOsm ? 'visible' : 'none' }}
          paint={{
            'line-color': s.line,
            'line-width': 2,
          }}
        />
        <Layer
          id={`${SOURCE_ID}-diff-official-fill`}
          type="fill"
          source={SOURCE_ID}
          source-layer={sourceLayer}
          filter={filterOfficialDiff}
          layout={{ visibility: showDiff ? 'visible' : 'none' }}
          paint={{
            'fill-color': d.official.fill,
            'fill-opacity': d.official.fillOpacity,
          }}
        />
        <Layer
          id={`${SOURCE_ID}-diff-official-line`}
          type="line"
          source={SOURCE_ID}
          source-layer={sourceLayer}
          filter={filterOfficialDiff}
          layout={{
            visibility: showDiff ? 'visible' : 'none',
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': d.official.line,
            'line-width': d.lineWidth,
            'line-opacity': d.official.lineOpacity,
            // Positive offset = exterior for polygon rings — centers the thick stroke outside the fill.
            'line-offset': d.lineWidth / 2,
          }}
        />
        <Layer
          id={`${SOURCE_ID}-diff-osm-fill`}
          type="fill"
          source={SOURCE_ID}
          source-layer={sourceLayer}
          filter={filterOsmDiff}
          layout={{ visibility: showDiff ? 'visible' : 'none' }}
          paint={{
            'fill-color': d.osm.fill,
            'fill-opacity': d.osm.fillOpacity,
          }}
        />
        <Layer
          id={`${SOURCE_ID}-diff-osm-line`}
          type="line"
          source={SOURCE_ID}
          source-layer={sourceLayer}
          filter={filterOsmDiff}
          layout={{
            visibility: showDiff ? 'visible' : 'none',
            'line-cap': 'round',
            'line-join': 'round',
          }}
          paint={{
            'line-color': d.osm.line,
            'line-width': d.lineWidth,
            'line-opacity': d.osm.lineOpacity,
            'line-offset': d.lineWidth / 2,
          }}
        />
      </Source>
    </MapLibre>
  )
}
