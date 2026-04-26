import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { FeatureDatasetProperties } from '../components/FeatureDatasetProperties'
import { FeatureDetailMapSection } from '../components/featureDetail/FeatureDetailMapSection'
import { FeatureDetailStatsStrip } from '../components/featureDetail/FeatureDetailStatsStrip'
import { LiveSourceProperties } from '../components/LiveSourceProperties'
import { ReportDataProvenanceFooter } from '../components/ReportDataProvenanceFooter'
import { ReportLicenseCompatibilitySection } from '../components/ReportLicenseCompatibilitySection'
import { UpdateMapInstructions } from '../components/UpdateMapInstructions'
import { featureQueryOptions } from '../data/load'
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
  const data = featureQuery.data ?? null
  const overpass = useFeatureDetailOverpass(featureLookupKey)
  const wfs = useFeatureDetailWfs(featureLookupKey)

  const row = !data || !featureKey ? null : findFeatureDetailRow(data, featureKey)
  if (featureQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
        <div className="text-red-400">{String(featureQuery.error)}</div>
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
