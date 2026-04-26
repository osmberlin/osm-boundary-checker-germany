import { lazy, Suspense } from 'react'
import { MapProvider } from 'react-map-gl/maplibre'
import type { ViewState } from 'react-map-gl/maplibre'
import {
  comparisonPmtilesMaplibreUrl,
  comparisonUnmatchedPmtilesMaplibreUrl,
} from '../../data/paths'
import { de } from '../../i18n/de'
import type { MapViewQueryValue } from '../../lib/mapViewQueryParam'
import type { OverpassGeoJsonFeatureCollection } from '../../lib/overpassBbox'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { InfoNotice } from '../InfoNotice'

const ComparisonMapShell = lazy(() => import('../map/ComparisonMapShell'))

type MapLayerControls = {
  showOfficial: boolean
  setShowOfficial: (v: boolean) => void
  showOsm: boolean
  setShowOsm: (v: boolean) => void
  showDiff: boolean
  setShowDiff: (v: boolean) => void
}

export function FeatureDetailMapSection({
  areaKey,
  data,
  row,
  mapLayers,
  mapView,
  overpassGeojson,
  wfsGeojson,
}: {
  areaKey: string
  data: ComparisonForReport
  row: ReportRow
  mapLayers: MapLayerControls
  mapView: {
    mapView: MapViewQueryValue | null
    commitMapViewFromMap: (viewState: ViewState) => void
  }
  overpassGeojson: OverpassGeoJsonFeatureCollection | null
  wfsGeojson: GeoJSON.FeatureCollection | null
}) {
  const hasRowMapTiles =
    row.category === 'unmatched_osm' ? data.hasUnmatchedPmtiles === true : data.hasPmtiles

  if (!hasRowMapTiles) {
    return <InfoNotice className="mt-4">{de.feature.noPmtiles}</InfoNotice>
  }

  return (
    <div className="mt-4 w-full overflow-hidden rounded border border-slate-700">
      <div className="h-[480px] w-full">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-slate-500">
              {de.feature.loadingMap}
            </div>
          }
        >
          <MapProvider>
            <ComparisonMapShell
              sources={{
                primary: {
                  pmtilesUrl: comparisonPmtilesMaplibreUrl(areaKey),
                  sourceLayer: data.tippecanoeLayer,
                },
                unmatched: data.hasUnmatchedPmtiles
                  ? {
                      pmtilesUrl: comparisonUnmatchedPmtilesMaplibreUrl(areaKey),
                      sourceLayer: data.tippecanoeLayer,
                      visible: row.category === 'unmatched_osm',
                    }
                  : undefined,
              }}
              view={{
                featureId: row.canonicalMatchKey,
                mapBbox: row.mapBbox,
                urlMapView: mapView.mapView,
                onMoveEndCommitUrl: mapView.commitMapViewFromMap,
              }}
              layers={{
                showOfficial: row.category === 'unmatched_osm' ? false : mapLayers.showOfficial,
                showOsm: row.category === 'unmatched_osm' ? false : mapLayers.showOsm,
                showDiff: row.category === 'unmatched_osm' ? false : mapLayers.showDiff,
              }}
              overlays={{
                overpassGeojson,
                wfsGeojson,
              }}
            />
          </MapProvider>
        </Suspense>
      </div>
    </div>
  )
}
