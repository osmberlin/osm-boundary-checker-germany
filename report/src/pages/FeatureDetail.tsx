import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { FeatureDatasetProperties } from '../components/FeatureDatasetProperties'
import { ExpectedOsmTagsSection } from '../components/featureDetail/ExpectedOsmTagsSection'
import { FeatureDetailMapSection } from '../components/featureDetail/FeatureDetailMapSection'
import { FeatureDetailStatsStrip } from '../components/featureDetail/FeatureDetailStatsStrip'
import { MatcherContextSection } from '../components/featureDetail/MatcherContextSection'
import { OfficialOnlyCandidatesSection } from '../components/featureDetail/OfficialOnlyCandidatesSection'
import { OsmKeyDiagnosticsSection } from '../components/featureDetail/OsmKeyDiagnosticsSection'
import { LiveSourceProperties } from '../components/LiveSourceProperties'
import { ReportDataProvenanceFooter } from '../components/ReportDataProvenanceFooter'
import { ReportLicenseCompatibilitySection } from '../components/ReportLicenseCompatibilitySection'
import { RouteLoadingPane } from '../components/RouteLoadingPane'
import { UpdateMapInstructions } from '../components/UpdateMapInstructions'
import { comparisonQueryOptions, featureQueryOptions, runStatusQueryOptions } from '../data/load'
import { useComparisonMapLayers } from '../hooks/useComparisonMapLayers'
import { useFeatureDetailOverpass } from '../hooks/useFeatureDetailOverpass'
import { useFeatureDetailWfs } from '../hooks/useFeatureDetailWfs'
import { useFilteredLiveOverlays } from '../hooks/useFilteredLiveOverlays'
import { useMapViewParam } from '../hooks/useMapViewParam'
import { de } from '../i18n/de'
import { findFeatureDetailRow } from '../lib/findFeatureDetailRow'
import { safeDecodeURIComponent } from '../lib/safeDecodeURIComponent'

export function FeatureDetail() {
  const { areaId, featureKey } = useParams({ strict: false })
  const areaKey = areaId ?? ''
  const featureLookupKey = featureKey ?? ''
  const mapLayers = useComparisonMapLayers()
  const mapViewParam = useMapViewParam()
  const featureQuery = useQuery({
    ...featureQueryOptions(areaKey, featureLookupKey),
    enabled: areaId != null && featureKey != null,
  })
  const comparisonQuery = useQuery({
    ...comparisonQueryOptions(areaKey),
    enabled: areaId != null,
  })
  const runStatusQuery = useQuery(runStatusQueryOptions())
  const data = featureQuery.data ?? null
  const overpass = useFeatureDetailOverpass(featureLookupKey)
  const wfs = useFeatureDetailWfs(featureLookupKey)
  const filteredLiveOverlays = useFilteredLiveOverlays({
    featureKey: featureLookupKey,
    wfsGeojson: wfs.geojson,
    overpassGeojson: overpass.geojson,
  })

  const row = !data || !featureKey ? null : findFeatureDetailRow(data, featureKey)
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
      const decoded = featureKey ? safeDecodeURIComponent(featureKey) : ''
      return <RouteLoadingPane title={de.routeLoading.feature(decoded)} />
    }
    return (
      <div className="mx-auto max-w-5xl px-4 pt-4 text-left sm:px-6 lg:px-8">
        <p className="text-slate-400">{de.feature.notFound}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 text-left sm:px-6 lg:px-8">
      {showCompareFailedNotice ? (
        <div className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {de.feature.compareFailedNotice}
        </div>
      ) : null}
      <FeatureDetailStatsStrip row={row} mapLayers={mapLayers} data={data} />

      <FeatureDetailMapSection
        areaKey={areaKey}
        data={data}
        interactionData={comparisonQuery.data ?? data}
        row={row}
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

      <OsmKeyDiagnosticsSection row={row} />

      <MatcherContextSection areaKey={areaKey} data={data} row={row} />

      <LiveSourceProperties
        key={row.canonicalMatchKey}
        featureKey={featureLookupKey}
        data={data}
        row={row}
        wfs={{
          load: wfs.loadSource,
          getStatus: wfs.getStatus,
        }}
        overpass={{
          hasData: overpass.hasData,
          hits: overpass.hits,
          run: overpass.runOverpass,
          reset: overpass.resetOverpass,
        }}
      />

      <ReportLicenseCompatibilitySection data={data} />
    </div>
  )
}
