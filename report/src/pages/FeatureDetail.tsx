import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { MapProvider } from 'react-map-gl/maplibre'
import { DatasetDiscussionAlerts } from '../components/discussion/DatasetDiscussionAlerts'
import { FeatureDatasetProperties } from '../components/FeatureDatasetProperties'
import { ExpectedOsmTagsSection } from '../components/featureDetail/ExpectedOsmTagsSection'
import { FeatureDetailHeader } from '../components/featureDetail/FeatureDetailHeader'
import { FeatureDetailMapSection } from '../components/featureDetail/FeatureDetailMapSection'
import { FeatureDetailStatsDiffMetricsSection } from '../components/featureDetail/FeatureDetailStatsDiffMetricsSection'
import { FeatureDetailStatsSummarySection } from '../components/featureDetail/FeatureDetailStatsSummarySection'
import { OfficialOnlyCandidatesSection } from '../components/featureDetail/OfficialOnlyCandidatesSection'
import { LiveSourceProperties } from '../components/LiveSourceProperties'
import { ReportDataProvenanceFooter } from '../components/ReportDataProvenanceFooter'
import { ReportLicenseCompatibilitySection } from '../components/ReportLicenseCompatibilitySection'
import { RouteLoadingPane } from '../components/RouteLoadingPane'
import { UpdateMapInstructions } from '../components/UpdateMapInstructions'
import {
  comparisonQueryOptions,
  featureQueryOptions,
  runStatusQueryOptions,
  type FeatureDetailComparison,
} from '../data/load'
import { useComparisonMapLayers } from '../hooks/useComparisonMapLayers'
import { useFeatureDetailOverpass } from '../hooks/useFeatureDetailOverpass'
import { useFeatureDetailWfs } from '../hooks/useFeatureDetailWfs'
import { useFilteredLiveOverlays } from '../hooks/useFilteredLiveOverlays'
import { useLiveQueryBboxFromMap } from '../hooks/useLiveQueryBboxFromMap'
import { useMapViewParam } from '../hooks/useMapViewParam'
import { de } from '../i18n/de'
import { featureDetailHasComparisonMap } from '../lib/featureDetailHasComparisonMap'
import { findFeatureDetailRow } from '../lib/findFeatureDetailRow'
import { FEATURE_DETAIL_ROUTE_FROM } from '../lib/parseFeatureDetailRouteParams'
import { safeDecodeURIComponent } from '../lib/safeDecodeURIComponent'
import type { ComparisonForReport, OgcWfsInspectSource, ReportRow } from '../types/report'

const EMPTY_OGC_SOURCES: readonly OgcWfsInspectSource[] = []

type MapLayerControls = ReturnType<typeof useComparisonMapLayers>
type MapViewParam = ReturnType<typeof useMapViewParam>

function FeatureDetailWithMapContext({
  areaKey,
  featureLookupKey,
  row,
  data,
  comparisonOverlayData,
  mapLayers,
  mapViewParam,
  showCompareFailedNotice,
}: {
  areaKey: string
  featureLookupKey: string
  row: ReportRow
  data: FeatureDetailComparison
  comparisonOverlayData: ComparisonForReport
  mapLayers: MapLayerControls
  mapViewParam: MapViewParam
  showCompareFailedNotice: boolean
}) {
  const { getLiveQueryBbox } = useLiveQueryBboxFromMap()
  const overpass = useFeatureDetailOverpass(featureLookupKey)
  const wfs = useFeatureDetailWfs({
    featureKey: featureLookupKey,
    sources: data.ogcInspectSources ?? EMPTY_OGC_SOURCES,
  })
  const filteredLiveOverlays = useFilteredLiveOverlays({
    featureKey: featureLookupKey,
    wfsGeojson: wfs.geojson,
    overpassGeojson: overpass.geojson,
  })
  const hasComparisonMap = featureDetailHasComparisonMap(row, data)

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 text-left sm:px-6 lg:px-8">
      <div className="flex flex-col gap-10">
        <FeatureDetailHeader titlePrefix={data.titlePrefix} row={row} />
        <DatasetDiscussionAlerts />
        {showCompareFailedNotice ? (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {de.feature.compareFailedNotice}
          </div>
        ) : null}
        <FeatureDetailStatsSummarySection row={row} data={data} />
        {row.metrics ? <FeatureDetailStatsDiffMetricsSection metrics={row.metrics} /> : null}

        <FeatureDetailMapSection
          areaKey={areaKey}
          data={data}
          row={row}
          interactionData={comparisonOverlayData}
          mapLayers={mapLayers}
          mapView={mapViewParam}
          overpassGeojson={filteredLiveOverlays.overpassGeojson}
          wfsGeojson={filteredLiveOverlays.wfsGeojson}
        />

        <UpdateMapInstructions areaId={areaKey} row={row} />

        <ReportDataProvenanceFooter data={data} row={row} hideFreshnessSection />

        <FeatureDatasetProperties row={row} data={data} />

        <ExpectedOsmTagsSection areaKey={areaKey} data={data} row={row} />

        <OfficialOnlyCandidatesSection row={row} candidates={data.candidates} />

        {hasComparisonMap ? (
          <LiveSourceProperties
            featureKey={featureLookupKey}
            data={data}
            row={row}
            getLiveQueryBbox={getLiveQueryBbox}
            wfs={{
              load: wfs.loadSource,
              getStatus: wfs.getStatus,
            }}
            overpass={{
              hasCachedData: overpass.hasCachedData,
              hits: overpass.hits,
              isRunPending: overpass.isRunPending,
              runError: overpass.runError,
              runLiveOverpass: overpass.runLiveOverpass,
              resetLiveOverpass: overpass.resetLiveOverpass,
              resetRunMutation: overpass.resetRunMutation,
            }}
          />
        ) : null}

        <ReportLicenseCompatibilitySection data={data} />
      </div>
    </div>
  )
}

export function FeatureDetail() {
  const { areaId: areaKey, featureKey: featureLookupKey } = useParams({
    from: FEATURE_DETAIL_ROUTE_FROM,
  })
  const mapLayers = useComparisonMapLayers()
  const mapViewParam = useMapViewParam()
  const featureQuery = useQuery(featureQueryOptions(areaKey, featureLookupKey))
  const comparisonQuery = useQuery(comparisonQueryOptions(areaKey))
  const runStatusQuery = useQuery(runStatusQueryOptions())
  const data = featureQuery.data ?? null
  const row = !data ? null : findFeatureDetailRow(data, featureLookupKey)
  const compareBranch = runStatusQuery.data?.areas?.[areaKey]?.compare
  const showCompareFailedNotice = compareBranch?.status === 'compare_failed'
  if (featureQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-4 text-left sm:px-6 lg:px-8">
        <div className="text-red-400">{String(featureQuery.error)}</div>
        {showCompareFailedNotice ? (
          <p className="mt-2 text-sm text-amber-300">{de.feature.compareFailedNotice}</p>
        ) : null}
      </div>
    )
  }
  if (featureQuery.isPending || !data || !row) {
    if (!data) {
      const decoded = safeDecodeURIComponent(featureLookupKey)
      return <RouteLoadingPane title={de.routeLoading.feature(decoded)} />
    }
    return (
      <div className="mx-auto max-w-5xl px-4 pt-4 text-left sm:px-6 lg:px-8">
        <p className="text-slate-400">{de.feature.notFound}</p>
      </div>
    )
  }

  return (
    <MapProvider>
      <FeatureDetailWithMapContext
        key={`${areaKey}/${featureLookupKey}`}
        areaKey={areaKey}
        featureLookupKey={featureLookupKey}
        row={row}
        data={data}
        comparisonOverlayData={comparisonQuery.data ?? data}
        mapLayers={mapLayers}
        mapViewParam={mapViewParam}
        showCompareFailedNotice={showCompareFailedNotice}
      />
    </MapProvider>
  )
}
