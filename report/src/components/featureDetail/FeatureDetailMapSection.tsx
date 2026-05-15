import { useState, useId } from 'react'
import type { ViewState } from 'react-map-gl/maplibre'
import { useComparisonMapLayers } from '../../hooks/useComparisonMapLayers'
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
import { toDetailMapMaxBounds } from './featureDetailMapSectionUtils'

export function FeatureDetailMapSection({
  areaKey,
  data,
  interactionData,
  row,
  mapView,
  overpassGeojson,
  wfsGeojson,
}: {
  areaKey: string
  data: ComparisonForReport
  interactionData: ComparisonForReport
  row: ReportRow
  mapView: {
    mapView: MapViewQueryValue | null
    commitMapViewFromMap: (viewState: ViewState) => void
  }
  overpassGeojson: OverpassGeoJsonFeatureCollection | null
  wfsGeojson: GeoJSON.FeatureCollection | null
}) {
  const mapLayers = useComparisonMapLayers()
  const { showOnlySelected } = useFeatureDetailMapBoundaryScope()
  const [overlapPickKeys, setOverlapPickKeys] = useState<string[] | null>(null)
  const hasRowMapTiles = featureDetailHasComparisonMap(row, data)
  const detailMaxBounds = toDetailMapMaxBounds(row.mapBbox)
  const layerId = useId()

  if (!hasRowMapTiles) {
    return <InfoNotice>{de.feature.noPmtiles}</InfoNotice>
  }

  return (
    <div className="w-full">
      <div className="flex w-full flex-col gap-0">
        <FeatureDetailMapLayerKpiSection
          layerIdPrefix={layerId}
          metrics={row.metrics}
          mapLayers={mapLayers}
        />

        <FeatureDetailComparisonMapPane
          areaKey={areaKey}
          data={data}
          interactionData={interactionData}
          row={row}
          mapView={mapView}
          overpassGeojson={overpassGeojson}
          wfsGeojson={wfsGeojson}
          showOnlySelected={showOnlySelected}
          detailMaxBounds={detailMaxBounds}
          hasMetrics={row.metrics != null}
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
