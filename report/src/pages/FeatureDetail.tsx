import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { FeatureDatasetProperties } from '../components/FeatureDatasetProperties'
import { ExpectedOsmTagsSection } from '../components/featureDetail/ExpectedOsmTagsSection'
import { FeatureDetailMapSection } from '../components/featureDetail/FeatureDetailMapSection'
import { FeatureDetailStatsStrip } from '../components/featureDetail/FeatureDetailStatsStrip'
import { MatcherContextSection } from '../components/featureDetail/MatcherContextSection'
import { LiveSourceProperties } from '../components/LiveSourceProperties'
import { ReportDataProvenanceFooter } from '../components/ReportDataProvenanceFooter'
import { ReportLicenseCompatibilitySection } from '../components/ReportLicenseCompatibilitySection'
import { UpdateMapInstructions } from '../components/UpdateMapInstructions'
import { featureQueryOptions, runStatusQueryOptions } from '../data/load'
import { useComparisonMapLayers } from '../hooks/useComparisonMapLayers'
import { useFeatureDetailOverpass } from '../hooks/useFeatureDetailOverpass'
import { useFeatureDetailWfs } from '../hooks/useFeatureDetailWfs'
import { useMapViewParam } from '../hooks/useMapViewParam'
import { de } from '../i18n/de'
import { findFeatureDetailRow } from '../lib/findFeatureDetailRow'

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
  const runStatusQuery = useQuery(runStatusQueryOptions())
  const data = featureQuery.data ?? null
  const overpass = useFeatureDetailOverpass(featureLookupKey)
  const wfs = useFeatureDetailWfs(featureLookupKey)

  const row = !data || !featureKey ? null : findFeatureDetailRow(data, featureKey)
  const compareBranch = runStatusQuery.data?.areas?.[areaKey]?.compare
  const showCompareFailedNotice = compareBranch?.status === 'compare_failed'
  if (featureQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
        <div className="text-red-400">{String(featureQuery.error)}</div>
        {showCompareFailedNotice ? (
          <p className="mt-2 text-sm text-amber-300">{de.feature.compareFailedNotice}</p>
        ) : null}
      </div>
    )
  }
  if (featureQuery.isPending || !data || !row) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
        <p className="text-slate-400">{!data ? de.feature.loading : de.feature.notFound}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
      {showCompareFailedNotice ? (
        <div className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {de.feature.compareFailedNotice}
        </div>
      ) : null}
      <FeatureDetailStatsStrip row={row} mapLayers={mapLayers} data={data} />

      <FeatureDetailMapSection
        areaKey={areaKey}
        data={data}
        row={row}
        mapLayers={mapLayers}
        mapView={mapViewParam}
        overpassGeojson={overpass.geojson}
        wfsGeojson={wfs.geojson}
      />

      <FeatureDatasetProperties row={row} />

      <ExpectedOsmTagsSection areaKey={areaKey} data={data} row={row} />

      <MatcherContextSection areaKey={areaKey} data={data} row={row} />

      <LiveSourceProperties
        key={row.canonicalMatchKey}
        data={data}
        row={row}
        wfs={{
          load: wfs.loadSource,
          getStatus: wfs.getStatus,
        }}
        overpass={{
          hits: overpass.hits,
          run: overpass.runOverpass,
          reset: overpass.resetOverpass,
        }}
      />

      <UpdateMapInstructions areaId={areaKey} row={row} />

      <ReportLicenseCompatibilitySection data={data} />
      <ReportDataProvenanceFooter data={data} hideFreshnessSection />
    </div>
  )
}
