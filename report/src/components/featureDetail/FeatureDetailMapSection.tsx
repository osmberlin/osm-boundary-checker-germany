import { useState, useId } from 'react'
import type { ViewState } from 'react-map-gl/maplibre'
import { useFeatureDetailMapBoundaryScope } from '../../hooks/useFeatureDetailMapBoundaryScope'
import { de } from '../../i18n/de'
import { featureDetailHasComparisonMap } from '../../lib/featureDetailHasComparisonMap'
import type { MapViewQueryValue } from '../../lib/mapViewQueryParam'
import type { OverpassGeoJsonFeatureCollection } from '../../lib/overpassBbox'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { InfoNotice } from '../InfoNotice'
import { MapOverlapPickDialog } from '../map/MapOverlapPickDialog'
import { FeatureDetailComparisonMapPane } from './FeatureDetailComparisonMapPane'
import { FeatureDetailMapLayerKpiSection } from './FeatureDetailMapLayerKpiSection'
import { toDetailMapMaxBounds, type MapLayerControls } from './featureDetailMapSectionUtils'

export function FeatureDetailMapSection({
  areaKey,
  data,
  interactionData,
  row,
  mapLayers,
  mapView,
  overpassGeojson,
  wfsGeojson,
}: {
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
}) {
  const { showOnlySelected } = useFeatureDetailMapBoundaryScope()
  const [overlapPickKeys, setOverlapPickKeys] = useState<string[] | null>(null)
  const hasRowMapTiles = featureDetailHasComparisonMap(row, data)
  const detailMaxBounds = toDetailMapMaxBounds(row.mapBbox)
  const m = row.metrics
  const layerId = useId()

  if (!hasRowMapTiles) {
    return <InfoNotice>{de.feature.noPmtiles}</InfoNotice>
  }

  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-0">
        {m ? (
          <FeatureDetailMapLayerKpiSection
            layerIdPrefix={layerId}
            metrics={m}
            mapLayers={mapLayers}
          />
        ) : null}

        <FeatureDetailComparisonMapPane
          areaKey={areaKey}
          data={data}
          interactionData={interactionData}
          row={row}
          mapLayers={mapLayers}
          mapView={mapView}
          overpassGeojson={overpassGeojson}
          wfsGeojson={wfsGeojson}
          showOnlySelected={showOnlySelected}
          detailMaxBounds={detailMaxBounds}
          hasMetrics={Boolean(m)}
          onOverlapPick={setOverlapPickKeys}
        />
      </div>
      <MapOverlapPickDialog
        open={overlapPickKeys !== null}
        keys={overlapPickKeys}
        areaKey={areaKey}
        data={interactionData}
        onClose={() => setOverlapPickKeys(null)}
      />
    </div>
  )
}
