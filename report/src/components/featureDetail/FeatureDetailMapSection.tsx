import { useNavigate } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import { MapProvider } from 'react-map-gl/maplibre'
import type { ViewState } from 'react-map-gl/maplibre'
import {
  comparisonPmtilesMaplibreUrl,
  comparisonUnmatchedPmtilesMaplibreUrl,
} from '../../data/paths'
import { useFeatureDetailMapBoundaryScope } from '../../hooks/useFeatureDetailMapBoundaryScope'
import { de } from '../../i18n/de'
import { handleComparisonMapFeatureClick } from '../../lib/comparisonMapFeatureClick'
import type { MapViewQueryValue } from '../../lib/mapViewQueryParam'
import type { OverpassGeoJsonFeatureCollection } from '../../lib/overpassBbox'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { MapOverlapPickDialog } from '../map/MapOverlapPickDialog'
import { InfoNotice } from '../InfoNotice'
import { FeatureDetailBoundaryScopeToggle } from './FeatureDetailBoundaryScopeToggle'

const ComparisonMapShell = lazy(() => import('../map/ComparisonMapShell'))
const DETAIL_MAP_MAX_BOUNDS_SCALE = 4

function toDetailMapMaxBounds(
  bbox: [number, number, number, number] | null,
): [[number, number], [number, number]] | undefined {
  if (!bbox) return undefined
  const [west, south, east, north] = bbox
  if (!(west < east && south < north)) return undefined

  const paddingRatio = (DETAIL_MAP_MAX_BOUNDS_SCALE - 1) / 2
  const lonPad = (east - west) * paddingRatio
  const latPad = (north - south) * paddingRatio
  const clampedWest = Math.max(-180, west - lonPad)
  const clampedSouth = Math.max(-85, south - latPad)
  const clampedEast = Math.min(180, east + lonPad)
  const clampedNorth = Math.min(85, north + latPad)
  if (!(clampedWest < clampedEast && clampedSouth < clampedNorth)) return undefined

  return [
    [clampedWest, clampedSouth],
    [clampedEast, clampedNorth],
  ]
}

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
  const navigate = useNavigate()
  const { showOnlySelected } = useFeatureDetailMapBoundaryScope()
  const [overlapPickKeys, setOverlapPickKeys] = useState<string[] | null>(null)
  const hasRowMapTiles =
    row.category === 'unmatched_osm' ? data.hasUnmatchedPmtiles === true : data.hasPmtiles
  const detailMaxBounds = toDetailMapMaxBounds(row.mapBbox)

  if (!hasRowMapTiles) {
    return <InfoNotice className="mt-4">{de.feature.noPmtiles}</InfoNotice>
  }

  return (
    <>
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
                  featureId: showOnlySelected ? row.canonicalMatchKey : null,
                  mapBbox: row.mapBbox,
                  maxBounds: showOnlySelected ? detailMaxBounds : undefined,
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
                interaction={
                  showOnlySelected
                    ? undefined
                    : {
                        onFeatureClick: (featureKeys) =>
                          handleComparisonMapFeatureClick({
                            featureKeys,
                            areaKey,
                            data,
                            navigate,
                            onOverlapPick: setOverlapPickKeys,
                          }),
                      }
                }
              />
            </MapProvider>
          </Suspense>
        </div>
        <div className="border-t border-slate-700 px-3 py-2.5">
          <FeatureDetailBoundaryScopeToggle />
        </div>
      </div>
      <MapOverlapPickDialog
        open={overlapPickKeys !== null}
        keys={overlapPickKeys}
        areaKey={areaKey}
        data={data}
        onClose={() => setOverlapPickKeys(null)}
      />
    </>
  )
}
