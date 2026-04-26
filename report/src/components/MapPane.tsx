import maplibregl from 'maplibre-gl'
import { useRef } from 'react'
import type { ViewState, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import MapLibre from 'react-map-gl/maplibre'
import { type MapViewQueryValue, serializeMapViewQueryString } from '../lib/mapViewQueryParam'
import type { OverpassGeoJsonFeatureCollection } from '../lib/overpassBbox'
import {
  ALL_INTERACTIVE_LAYER_IDS,
  COMPARISON_BASEMAP_STYLE,
  SOURCE_ID,
  UNMATCHED_SOURCE_ID,
} from './map/comparisonMapConstants'
import {
  featureIdFilterExpr,
  filterOfficialDiff,
  filterOfficialOverlay,
  filterOsmDiff,
  filterOsmOverlay,
  NEVER_MATCH_FILTER,
} from './map/comparisonMapFilters'
import { ensureComparisonMapSprites } from './map/comparisonMapSprites'
import { ComparisonVectorLayers } from './map/ComparisonVectorLayers'
import { OverpassOverlayLayers } from './map/OverpassOverlayLayers'
import { WfsOverlayLayers } from './map/WfsOverlayLayers'
import 'maplibre-gl/dist/maplibre-gl.css'

type MapPaneSources = {
  primary: {
    pmtilesUrl: string
    sourceLayer: string
    allowedFeatureIds?: string[] | null
  }
  unmatched?: {
    pmtilesUrl: string
    sourceLayer: string
    allowedFeatureIds?: string[] | null
    visible?: boolean
  }
}

type MapPaneView = {
  /** Single-feature view; use `null` to show all features (overview). */
  featureId: string | null
  mapBbox: [number, number, number, number] | null
  /** Optional camera clamp as [[west,south],[east,north]] in WGS84. */
  maxBounds?: [[number, number], [number, number]]
  urlMapView: MapViewQueryValue | null
  onMoveEndCommitUrl: (viewState: ViewState) => void
}

type MapPaneLayers = {
  showOfficial: boolean
  showOsm: boolean
  showDiff: boolean
}

type MapPaneInteraction = {
  /** Overview: navigate to feature detail when clicking a polygon. */
  onFeatureClick?: (featureKey: string) => void
}

type MapPaneOverlays = {
  overpassGeojson?: OverpassGeoJsonFeatureCollection | null
  wfsGeojson?: GeoJSON.FeatureCollection | null
}

type FeatureStateTarget = {
  source: string
  sourceLayer: string
  id: string | number
}

function toFeatureStateTarget(feature: GeoJSON.Feature): FeatureStateTarget | null {
  const mapFeature = feature as GeoJSON.Feature & {
    source?: unknown
    sourceLayer?: unknown
  }
  const source = typeof mapFeature.source === 'string' ? mapFeature.source : null
  const sourceLayer = typeof mapFeature.sourceLayer === 'string' ? mapFeature.sourceLayer : null
  const id =
    typeof mapFeature.id === 'string' || typeof mapFeature.id === 'number' ? mapFeature.id : null
  if (!source || !sourceLayer || id == null) return null
  return { source, sourceLayer, id }
}

export default function MapPane({
  sources,
  view,
  layers,
  interaction,
  overlays,
  mapId,
  onZoomChange,
}: {
  sources: MapPaneSources
  view: MapPaneView
  layers: MapPaneLayers
  interaction?: MapPaneInteraction
  overlays?: MapPaneOverlays
  /**
   * When set (e.g. via ComparisonMapShell), registers this map with MapProvider for `useMap()[mapId]`.
   * @see https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/map#mapprovider
   */
  mapId?: string
  /** Optional callback for zoom-aware UI hints outside the map component. */
  onZoomChange?: (zoom: number) => void
}) {
  const skipNextMoveEndCommitRef = useRef(false)
  const onFeatureClick = interaction?.onFeatureClick
  const { primary, unmatched } = sources
  const { featureId, mapBbox, maxBounds, urlMapView, onMoveEndCommitUrl } = view
  const { showOfficial, showOsm, showDiff } = layers
  const overpassGeojson = overlays?.overpassGeojson ?? null
  const wfsGeojson = overlays?.wfsGeojson ?? null

  const hoveredFeatureRef = useRef<{
    source: string
    sourceLayer: string
    id: string | number
  } | null>(null)

  const featureIdExpr = featureIdFilterExpr(featureId, primary.allowedFeatureIds ?? null)

  const initialViewState = urlMapView
    ? {
        longitude: urlMapView.longitude,
        latitude: urlMapView.latitude,
        zoom: urlMapView.zoom,
      }
    : {
        longitude: mapBbox ? (mapBbox[0] + mapBbox[2]) / 2 : 13.4,
        latitude: mapBbox ? (mapBbox[1] + mapBbox[3]) / 2 : 52.52,
        zoom: 10,
      }

  const clearHoveredFeature = (map: maplibregl.Map) => {
    const hovered = hoveredFeatureRef.current
    if (!hovered) return
    map.setFeatureState(
      {
        source: hovered.source,
        sourceLayer: hovered.sourceLayer,
        id: hovered.id,
      },
      { hover: false },
    )
    hoveredFeatureRef.current = null
  }

  function onLoad(e: { target: maplibregl.Map }) {
    ensureComparisonMapSprites(e.target)
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
  }

  function onMoveEnd(e: ViewStateChangeEvent) {
    if (skipNextMoveEndCommitRef.current) {
      skipNextMoveEndCommitRef.current = false
      return
    }
    const nextSerialized = serializeMapViewQueryString(e.viewState)
    const currentSerialized = urlMapView ? serializeMapViewQueryString(urlMapView) : null
    if (nextSerialized === currentSerialized) return
    onZoomChange?.(e.viewState.zoom)
    onMoveEndCommitUrl(e.viewState)
  }

  function onMapClick(e: { features?: GeoJSON.Feature[] }) {
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
  }

  function onMapMouseMove(e: { target: maplibregl.Map; features?: GeoJSON.Feature[] }) {
    const map = e.target
    const fs = e.features
    if (!fs?.length) {
      clearHoveredFeature(map)
      return
    }
    for (const f of fs) {
      const target = toFeatureStateTarget(f)
      if (!target) continue
      const prev = hoveredFeatureRef.current
      if (
        prev &&
        prev.source === target.source &&
        prev.sourceLayer === target.sourceLayer &&
        prev.id === target.id
      ) {
        return
      }
      clearHoveredFeature(map)
      map.setFeatureState(target, { hover: true })
      hoveredFeatureRef.current = target
      return
    }
    clearHoveredFeature(map)
  }

  function onMapMouseLeave(e: { target: maplibregl.Map }) {
    clearHoveredFeature(e.target)
  }

  return (
    <MapLibre
      id={mapId}
      mapLib={maplibregl}
      initialViewState={initialViewState}
      style={{
        width: '100%',
        height: '100%',
        cursor: onFeatureClick ? 'pointer' : undefined,
      }}
      mapStyle={COMPARISON_BASEMAP_STYLE}
      maxBounds={maxBounds}
      onLoad={onLoad}
      onMoveEnd={onMoveEnd}
      onClick={onFeatureClick ? onMapClick : undefined}
      onMouseMove={onFeatureClick ? onMapMouseMove : undefined}
      onMouseLeave={onFeatureClick ? onMapMouseLeave : undefined}
      interactiveLayerIds={onFeatureClick ? [...ALL_INTERACTIVE_LAYER_IDS] : undefined}
    >
      <ComparisonVectorLayers
        sourceId={SOURCE_ID}
        pmtilesUrl={primary.pmtilesUrl}
        sourceLayer={primary.sourceLayer}
        filterOfficialOverlay={filterOfficialOverlay(featureIdExpr)}
        filterOsmOverlay={filterOsmOverlay(featureIdExpr)}
        filterOfficialDiff={filterOfficialDiff(featureIdExpr)}
        filterOsmDiff={filterOsmDiff(featureIdExpr)}
        showOfficial={showOfficial}
        showOsm={showOsm}
        showDiff={showDiff}
      />
      {unmatched ? (
        <ComparisonVectorLayers
          sourceId={UNMATCHED_SOURCE_ID}
          pmtilesUrl={unmatched.pmtilesUrl}
          sourceLayer={unmatched.sourceLayer}
          filterOfficialOverlay={NEVER_MATCH_FILTER}
          filterOsmOverlay={filterOsmOverlay(
            featureIdFilterExpr(featureId, unmatched.allowedFeatureIds ?? null),
          )}
          filterOfficialDiff={NEVER_MATCH_FILTER}
          filterOsmDiff={NEVER_MATCH_FILTER}
          showOfficial={false}
          showOsm={unmatched.visible === true}
          showDiff={false}
        />
      ) : null}
      <WfsOverlayLayers geojson={wfsGeojson} />
      <OverpassOverlayLayers geojson={overpassGeojson} />
    </MapLibre>
  )
}
