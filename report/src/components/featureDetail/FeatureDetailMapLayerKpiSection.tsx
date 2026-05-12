import { de } from '../../i18n/de'
import { formatDeSquareKilometersFromM2 } from '../../lib/formatDe'
import type { ReportRow } from '../../types/report'
import { KpiSectionRow, KpiToggleCell } from '../FeatureStatBlocks'
import { mapLayerColors } from '../mapLayerColors'
import { hexToRgba } from '../MapLegend'
import { LegendRectSwatch } from '../reportCategoryStyles'
import { symmetricDiffAreaM2, type MapLayerControls } from './featureDetailMapSectionUtils'

type Props = {
  layerIdPrefix: string
  metrics: NonNullable<ReportRow['metrics']>
  mapLayers: MapLayerControls
}

export function FeatureDetailMapLayerKpiSection({ layerIdPrefix, metrics, mapLayers }: Props) {
  const featureStats = de.feature.stats
  const officialMatchedColors = mapLayerColors.officialMatched
  const osmPairedColors = mapLayerColors.osmPaired
  const diffLayerColors = mapLayerColors.diff

  return (
    <KpiSectionRow
      className="mb-0 rounded-t-md rounded-b-none border-x border-t border-b-0 border-slate-500 !bg-[#F2F3F1] text-slate-900 hover:!bg-[#eaede7]"
      rowClassName="mt-0 [&>*]:!border-l [&>*]:!border-slate-500 [&>*]:pl-3 [&>*]:first:!border-l-0 [&>*]:first:pl-0 [&>*]:lg:pl-6"
      aria-label={featureStats.layersRowAria}
    >
      <KpiToggleCell
        inputId={`${layerIdPrefix}-official`}
        checked={mapLayers.showOfficial}
        onChange={mapLayers.setShowOfficial}
        label={featureStats.areaOfficial}
        value={formatDeSquareKilometersFromM2(metrics.officialAreaM2)}
        swatch={
          <LegendRectSwatch
            items={[
              {
                borderColor: officialMatchedColors.line,
                backgroundColor: hexToRgba(
                  officialMatchedColors.fill,
                  officialMatchedColors.fillOpacity,
                ),
              },
            ]}
          />
        }
      />
      <KpiToggleCell
        inputId={`${layerIdPrefix}-osm`}
        checked={mapLayers.showOsm}
        onChange={mapLayers.setShowOsm}
        label={featureStats.areaOsm}
        value={formatDeSquareKilometersFromM2(metrics.osmAreaM2)}
        swatch={
          <LegendRectSwatch
            items={[
              {
                borderColor: osmPairedColors.line,
                backgroundColor: hexToRgba(osmPairedColors.fill, osmPairedColors.fillOpacity),
              },
            ]}
          />
        }
      />
      <KpiToggleCell
        inputId={`${layerIdPrefix}-diff`}
        checked={mapLayers.showDiff}
        onChange={mapLayers.setShowDiff}
        label={de.map.diff}
        value={formatDeSquareKilometersFromM2(symmetricDiffAreaM2(metrics))}
        swatch={
          <LegendRectSwatch
            items={[
              {
                borderColor: diffLayerColors.official.line,
                backgroundColor: hexToRgba(
                  diffLayerColors.official.fill,
                  diffLayerColors.official.fillOpacity,
                ),
              },
              {
                borderColor: diffLayerColors.osm.line,
                backgroundColor: hexToRgba(
                  diffLayerColors.osm.fill,
                  diffLayerColors.osm.fillOpacity,
                ),
              },
            ]}
          />
        }
      />
    </KpiSectionRow>
  )
}
