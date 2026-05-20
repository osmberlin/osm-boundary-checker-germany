import maplibregl from 'maplibre-gl'
import { useRef, useState } from 'react'
import type { ViewState, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import MapLibre from 'react-map-gl/maplibre'
import { type MapViewQueryValue, serializeMapViewQueryString } from '../lib/mapViewQueryParam'
import type { AddrPostcodeGeoJsonFeatureCollection } from '../lib/overpassAddrPostcode'
import type { OverpassGeoJsonFeatureCollection } from '../lib/overpassBbox'
import { AddrPostcodeOverlayLayers } from './map/AddrPostcodeOverlayLayers'
import { ComparisonDiffVectorLayers } from './map/ComparisonDiffVectorLayers'
import {
  ALL_INTERACTIVE_LAYER_IDS,
  COMPARISON_BASEMAP_STYLE,
  SOURCE_ID,
} from './map/comparisonMapConstants'
import { ensureComparisonMapSprites } from './map/comparisonMapSprites'
import { MapPanePrimaryPmtilesSource } from './map/MapPanePrimaryPmtilesSource'
import { MapPaneUnmatchedPmtilesSource } from './map/MapPaneUnmatchedPmtilesSource'
import { OverpassOverlayLayers } from './map/OverpassOverlayLayers'
import { WfsOverlayLayers } from './map/WfsOverlayLayers'
import 'maplibre-gl/dist/maplibre-gl.css'

type MapPaneSources = {
  primary: {
    pmtilesUrl: string
    sourceLayer: string
    allowedFeatureIds?: string[] | null
    officialOnlyFeatureIds?: string[] | null
  }
  /** Diff-only archive: mounted only when `layers.showDiff` is true. Same `featureId` keys as overlay; filters reuse `primary.allowedFeatureIds`. */
  diff?: {
    pmtilesUrl: string
    sourceLayer: string
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
  /** Overview: navigate to feature detail when clicking polygon(s); ids are deduped. */
  onFeatureClick?: (featureKeys: string[]) => void
}

type MapPaneOverlays = {
  overpassGeojson?: OverpassGeoJsonFeatureCollection | null
  addrPostcodeGeojson?: AddrPostcodeGeoJsonFeatureCollection | null
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
  mapMinZoom,
}: {
  sources: MapPaneSources
  view: MapPaneView
  layers: MapPaneLayers
  interaction?: MapPaneInteraction
  overlays?: MapPaneOverlays
  /**
   * When set, registers this map with `MapProvider` for `useMap()[mapId]` (e.g. comparison map id).
   * @see https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/map#mapprovider
   */
  mapId?: string
  /**
   * Lowest zoom allowed (MapLibre `minZoom`); must match `compare.minZoom` / Tippecanoe
   * `--minimum-zoom` when > 0; use `0` for no floor.
   */
  mapMinZoom: number
}) {
  const { primary, diff: diffSource, unmatched } = sources
  const { featureId, mapBbox, maxBounds, urlMapView, onMoveEndCommitUrl } = view
  const { showOfficial, showOsm, showDiff } = layers
  const overpassGeojson = overlays?.overpassGeojson ?? null
  const addrPostcodeGeojson = overlays?.addrPostcodeGeojson ?? null
  const wfsGeojson = overlays?.wfsGeojson ?? null

  const overviewBoundsCamera =
    !urlMapView && mapBbox !== null && mapBbox[0] < mapBbox[2] && mapBbox[1] < mapBbox[3]

  // Stable key when camera is driven by `?map=` — serializing the view here would change the key on every moveend URL sync and remount the map (flicker).
  const openingKey = urlMapView
    ? 'url'
    : overviewBoundsCamera && mapBbox
      ? `bbox:${mapBbox[0]},${mapBbox[1]},${mapBbox[2]},${mapBbox[3]}`
      : 'default'

  /** Skip the first `moveend` after remount (`key={openingKey}`) when fitBounds drives the camera. */
  const skipNextMoveEndCommitRef = useRef(false)

  const hoveredFeatureRef = useRef<{
    source: string
    sourceLayer: string
    id: string | number
  } | null>(null)

  const [isStripePatternReady, setIsStripePatternReady] = useState(false)
  const onFeatureClick = interaction?.onFeatureClick
  const officialOnlyInteractiveFillId = `${SOURCE_ID}-overlay-official-only-fill`
  const interactiveLayerIds =
    onFeatureClick &&
    ((primary.officialOnlyFeatureIds ?? []).length === 0
      ? ALL_INTERACTIVE_LAYER_IDS.filter((id) => id !== officialOnlyInteractiveFillId)
      : [...ALL_INTERACTIVE_LAYER_IDS])

  const initialViewState = urlMapView
    ? {
        longitude: urlMapView.longitude,
        latitude: urlMapView.latitude,
        zoom: Math.max(urlMapView.zoom, mapMinZoom),
      }
    : overviewBoundsCamera && mapBbox
      ? {
          bounds: [
            [mapBbox[0], mapBbox[1]],
            [mapBbox[2], mapBbox[3]],
          ] as [[number, number], [number, number]],
          fitBoundsOptions: { padding: 40 },
        }
      : {
          longitude: mapBbox ? (mapBbox[0] + mapBbox[2]) / 2 : 13.4,
          latitude: mapBbox ? (mapBbox[1] + mapBbox[3]) / 2 : 52.52,
          zoom: Math.max(10, mapMinZoom),
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
    skipNextMoveEndCommitRef.current = overviewBoundsCamera
    ensureComparisonMapSprites(e.target)
    setIsStripePatternReady(true)
  }

  function onMoveEnd(e: ViewStateChangeEvent) {
    if (skipNextMoveEndCommitRef.current) {
      skipNextMoveEndCommitRef.current = false
      return
    }
    const nextSerialized = serializeMapViewQueryString(e.viewState)
    const currentSerialized = urlMapView ? serializeMapViewQueryString(urlMapView) : null
    if (nextSerialized === currentSerialized) return
    onMoveEndCommitUrl(e.viewState)
  }

  function onMapClick(e: { features?: GeoJSON.Feature[] }) {
    if (!onFeatureClick) return
    const fs = e.features
    if (!fs?.length) return
    const ids: string[] = []
    for (const f of fs) {
      const props = f.properties as Record<string, unknown> | null
      const id = props?.featureId
      if (typeof id === 'string' && id.length > 0) ids.push(id)
    }
    const uniqueKeys = [...new Set(ids)]
    if (uniqueKeys.length > 0) onFeatureClick(uniqueKeys)
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
      key={openingKey}
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
      minZoom={mapMinZoom}
      onLoad={onLoad}
      onMoveEnd={onMoveEnd}
      onClick={onFeatureClick ? onMapClick : undefined}
      onMouseMove={onFeatureClick ? onMapMouseMove : undefined}
      onMouseLeave={onFeatureClick ? onMapMouseLeave : undefined}
      interactiveLayerIds={interactiveLayerIds || undefined}
    >
      <MapPanePrimaryPmtilesSource
        primary={primary}
        featureId={featureId}
        showOfficial={showOfficial}
        showOsm={showOsm}
        isStripePatternReady={isStripePatternReady}
      />
      <ComparisonDiffVectorLayers
        diffSource={diffSource}
        showDiff={showDiff}
        featureId={featureId}
        allowedFeatureIds={primary.allowedFeatureIds ?? null}
      />
      <MapPaneUnmatchedPmtilesSource
        unmatched={unmatched}
        featureId={featureId}
        isStripePatternReady={isStripePatternReady}
      />
      <WfsOverlayLayers geojson={wfsGeojson} />
      <OverpassOverlayLayers geojson={overpassGeojson} />
      <AddrPostcodeOverlayLayers geojson={addrPostcodeGeojson} />
    </MapLibre>
  )
}
