import { useNavigate } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import type { ViewState } from 'react-map-gl/maplibre'
import {
  comparisonPmtilesMaplibreUrl,
  comparisonUnmatchedPmtilesMaplibreUrl,
} from '../../data/paths'
import { de } from '../../i18n/de'
import { cn } from '../../lib/cn'
import { handleComparisonMapFeatureClick } from '../../lib/comparisonMapFeatureClick'
import type { MapViewQueryValue } from '../../lib/mapViewQueryParam'
import type { OverpassGeoJsonFeatureCollection } from '../../lib/overpassBbox'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { COMPARISON_MAP_ID } from '../map/comparisonMapConstants'
import { ComparisonMapZoomHintOverlay } from '../map/ComparisonMapZoomHintOverlay'
import { FeatureDetailBoundaryScopeToggle } from './FeatureDetailBoundaryScopeToggle'
import type { MapLayerControls } from './featureDetailMapSectionUtils'

const MapPane = lazy(() => import('../MapPane'))

type Props = {
  areaKey: string
  data: ComparisonForReport
  interactionData: ComparisonForReport
  row: ReportRow
  mapLayers: MapLayerControls
  mapView: {
    mapView: MapViewQueryValue | null
    commitMapViewFromMap: (viewState: ViewState) => void
  }
  overpassGeojson: OverpassGeoJsonFeatureCollection | null
  wfsGeojson: GeoJSON.FeatureCollection | null
  showOnlySelected: boolean
  detailMaxBounds: [[number, number], [number, number]] | undefined
  hasMetrics: boolean
  onOverlapPick: (keys: string[]) => void
}

export function FeatureDetailComparisonMapPane({
  areaKey,
  data,
  interactionData,
  row,
  mapLayers,
  mapView,
  overpassGeojson,
  wfsGeojson,
  showOnlySelected,
  detailMaxBounds,
  hasMetrics,
  onOverlapPick,
}: Props) {
  const navigate = useNavigate()

  return (
    <div className="flex w-full flex-col gap-0">
      <div
        className={cn(
          'w-full overflow-hidden rounded-b-md border-x border-t border-b border-slate-500',
          hasMetrics && 'rounded-t-none',
        )}
      >
        <div className="h-[480px] w-full">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-slate-500">
                {de.feature.loadingMap}
              </div>
            }
          >
            <div className="relative h-full w-full">
              <MapPane
                mapId={COMPARISON_MAP_ID}
                mapMinZoom={data.filterConfigSummary.minZoom}
                sources={{
                  primary: {
                    pmtilesUrl: comparisonPmtilesMaplibreUrl(areaKey),
                    sourceLayer: data.tippecanoeLayer,
                    allowedFeatureIds: showOnlySelected
                      ? [row.canonicalMatchKey]
                      : interactionData.rows.map((r) => r.canonicalMatchKey),
                    officialOnlyFeatureIds: showOnlySelected
                      ? row.category === 'official_only'
                        ? [row.canonicalMatchKey]
                        : []
                      : interactionData.rows
                          .filter((r) => r.category === 'official_only')
                          .map((r) => r.canonicalMatchKey),
                  },
                  unmatched: data.hasUnmatchedPmtiles
                    ? {
                        pmtilesUrl: comparisonUnmatchedPmtilesMaplibreUrl(areaKey),
                        sourceLayer: data.tippecanoeLayer,
                        allowedFeatureIds: showOnlySelected
                          ? row.category === 'unmatched_osm'
                            ? [row.canonicalMatchKey]
                            : []
                          : interactionData.unmatchedOsm.map((r) => r.canonicalMatchKey),
                        visible:
                          (row.category === 'unmatched_osm' || !showOnlySelected) &&
                          mapLayers.showOsm,
                      }
                    : undefined,
                }}
                view={{
                  featureId: showOnlySelected ? row.canonicalMatchKey : null,
                  mapBbox: row.mapBbox,
                  maxBounds: showOnlySelected ? detailMaxBounds : undefined,
                  urlMapView: mapView.mapView,
                  onMoveEndCommitUrl: mapView.commitMapViewFromMap,
                }}
                layers={{
                  showOfficial:
                    row.category === 'unmatched_osm' && showOnlySelected
                      ? false
                      : mapLayers.showOfficial,
                  showOsm:
                    row.category === 'unmatched_osm' && showOnlySelected
                      ? false
                      : mapLayers.showOsm,
                  showDiff:
                    row.category === 'unmatched_osm' && showOnlySelected
                      ? false
                      : mapLayers.showDiff,
                }}
                overlays={{
                  overpassGeojson,
                  wfsGeojson,
                }}
                interaction={
                  showOnlySelected
                    ? undefined
                    : {
                        onFeatureClick: (featureKeys) =>
                          handleComparisonMapFeatureClick({
                            featureKeys,
                            areaKey,
                            data: interactionData,
                            navigate,
                            onOverlapPick,
                          }),
                      }
                }
              />
              <ComparisonMapZoomHintOverlay />
            </div>
          </Suspense>
        </div>
        <div className="border-t border-slate-500 bg-[#F2F3F1] px-3 py-2.5">
          <FeatureDetailBoundaryScopeToggle />
        </div>
      </div>
    </div>
  )
}
