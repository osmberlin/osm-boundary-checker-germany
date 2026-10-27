import { lazy, Suspense } from 'react'
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
import { COMPARISON_MAP_ID } from '../map/comparisonMapConstants'
import { ComparisonMapZoomHintOverlay } from '../map/ComparisonMapZoomHintOverlay'
import { mapLayerColors } from '../mapLayerColors'

const MapPane = lazy(() => import('../MapPane'))

function LegendSwatch({ color, label }: { color: { fill: string; line: string }; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
      <span
        aria-hidden
        className="inline-block size-3 rounded-sm border-2"
        style={{ borderColor: color.line, backgroundColor: `${color.fill}55` }}
      />
      {label}
    </span>
  )
}

/** Both geometries on one map: the official-only area and the unmatched OSM relation. */
export function CompareMapSection({
  areaKey,
  data,
  officialRow,
  osmRow,
  mapBbox,
  mapView,
  overpassGeojson,
}: {
  areaKey: string
  data: ComparisonForReport
  officialRow: ReportRow
  osmRow: ReportRow
  mapBbox: [number, number, number, number] | null
  mapView: {
    mapView: MapViewQueryValue | null
    commitMapViewFromMap: (viewState: ViewState) => void
  }
  /** Live OSM geometry (Overpass by id), for datasets without unmatched tiles. */
  overpassGeojson: OverpassGeoJsonFeatureCollection | null
}) {
  if (!data.hasPmtiles) return <InfoNotice>{de.feature.noPmtiles}</InfoNotice>

  return (
    <div className="flex w-full flex-col gap-2">
      {data.hasUnmatchedPmtiles ? null : <InfoNotice>{de.compare.mapNoOsmTiles}</InfoNotice>}
      <div className="w-full overflow-hidden rounded-md border border-slate-500">
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
                    allowedFeatureIds: [officialRow.canonicalMatchKey],
                    officialOnlyFeatureIds: [officialRow.canonicalMatchKey],
                  },
                  unmatched: data.hasUnmatchedPmtiles
                    ? {
                        pmtilesUrl: comparisonUnmatchedPmtilesMaplibreUrl(areaKey),
                        sourceLayer: data.tippecanoeLayer,
                        allowedFeatureIds: [osmRow.canonicalMatchKey],
                        visible: true,
                      }
                    : undefined,
                }}
                view={{
                  featureId: null,
                  mapBbox,
                  urlMapView: mapView.mapView,
                  onMoveEndCommitUrl: mapView.commitMapViewFromMap,
                }}
                layers={{ showOfficial: true, showOsm: true, showDiff: false }}
                overlays={{ overpassGeojson }}
              />
              <ComparisonMapZoomHintOverlay />
            </div>
          </Suspense>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-500 bg-[#F2F3F1] px-3 py-2.5">
          <LegendSwatch color={mapLayerColors.officialOnly} label={de.compare.mapLegendOfficial} />
          <LegendSwatch color={mapLayerColors.osmUnmatched} label={de.compare.mapLegendOsm} />
        </div>
      </div>
    </div>
  )
}
