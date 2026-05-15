import { Layer, Source } from 'react-map-gl/maplibre'
import { mapLayerColors } from '../mapLayerColors'
import { DIFF_SOURCE_ID } from './comparisonMapConstants'
import { featureIdFilterExpr, filterOfficialDiff, filterOsmDiff } from './comparisonMapFilters'

/** Diff PMTiles only: display-only (no `feature-state` / hover). Renders nothing when there is no source or diff is off. */
export function ComparisonDiffVectorLayers({
  diffSource,
  showDiff,
  featureId,
  allowedFeatureIds,
}: {
  diffSource: { pmtilesUrl: string; sourceLayer: string } | null | undefined
  showDiff: boolean
  /** Same row scope as primary overlay (`view.featureId` + `primary.allowedFeatureIds`). */
  featureId: string | null
  allowedFeatureIds?: string[] | null
}) {
  if (!diffSource || !showDiff) return null

  const diffFeatureIdExpr = featureIdFilterExpr(featureId, allowedFeatureIds ?? null)
  const officialDiffFilter = filterOfficialDiff(diffFeatureIdExpr)
  const osmDiffFilter = filterOsmDiff(diffFeatureIdExpr)

  return (
    <Source id={DIFF_SOURCE_ID} type="vector" url={diffSource.pmtilesUrl} promoteId="featureId">
      <Layer
        id={`${DIFF_SOURCE_ID}-diff-official-fill`}
        type="fill"
        source={DIFF_SOURCE_ID}
        source-layer={diffSource.sourceLayer}
        filter={officialDiffFilter}
        paint={{
          'fill-color': mapLayerColors.diff.official.fill,
          'fill-opacity': mapLayerColors.diff.official.fillOpacity,
        }}
      />
      <Layer
        id={`${DIFF_SOURCE_ID}-diff-official-line`}
        type="line"
        source={DIFF_SOURCE_ID}
        source-layer={diffSource.sourceLayer}
        filter={officialDiffFilter}
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': mapLayerColors.diff.official.line,
          'line-width': mapLayerColors.diff.lineWidth,
          'line-opacity': mapLayerColors.diff.official.lineOpacity,
          'line-offset': mapLayerColors.diff.lineWidth / 2,
        }}
      />
      <Layer
        id={`${DIFF_SOURCE_ID}-diff-osm-fill`}
        type="fill"
        source={DIFF_SOURCE_ID}
        source-layer={diffSource.sourceLayer}
        filter={osmDiffFilter}
        paint={{
          'fill-color': mapLayerColors.diff.osm.fill,
          'fill-opacity': mapLayerColors.diff.osm.fillOpacity,
        }}
      />
      <Layer
        id={`${DIFF_SOURCE_ID}-diff-osm-line`}
        type="line"
        source={DIFF_SOURCE_ID}
        source-layer={diffSource.sourceLayer}
        filter={osmDiffFilter}
        layout={{
          'line-cap': 'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color': mapLayerColors.diff.osm.line,
          'line-width': mapLayerColors.diff.lineWidth,
          'line-opacity': mapLayerColors.diff.osm.lineOpacity,
          'line-offset': mapLayerColors.diff.lineWidth / 2,
        }}
      />
    </Source>
  )
}
