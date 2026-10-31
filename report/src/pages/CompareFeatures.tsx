import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { MapProvider } from 'react-map-gl/maplibre'
import { compareDiscussPath, featureDiscussPath } from '../../../scripts/shared/discussMatch.ts'
import { CompareKeySegments } from '../components/compare/CompareKeySegments'
import { CompareMapSection } from '../components/compare/CompareMapSection'
import { DatasetDiscussionAlerts } from '../components/discussion/DatasetDiscussionAlerts'
import { DiscussDatasetButton } from '../components/discussion/DiscussDatasetButton'
import { FeatureDatasetProperties } from '../components/FeatureDatasetProperties'
import {
  LiveOsmObjectLoadButton,
  type LiveOsmContext,
} from '../components/featureDetail/LiveOsmObject'
import { ReportCategoryLabel } from '../components/ReportCategoryLabel'
import { RouteLoadingPane } from '../components/RouteLoadingPane'
import { sharedButtonTinyClass } from '../components/sharedButtonStyles'
import { UpdateMapInstructions } from '../components/UpdateMapInstructions'
import {
  comparisonQueryOptions,
  featureQueryOptions,
  type FeatureDetailComparison,
} from '../data/load'
import { useLiveOsmObjects } from '../hooks/useLiveOsmObjects'
import { useMapViewParam } from '../hooks/useMapViewParam'
import { de } from '../i18n/de'
import {
  COMPARE_ROUTE_FROM,
  comparePairRow,
  findUnmatchedOsmRow,
  rowDisplayName,
} from '../lib/compareRows'
import { dtpCorrectionFormValues, osmObjectText } from '../lib/dtpCorrection'
import { findFeatureDetailRow } from '../lib/findFeatureDetailRow'
import { githubNewDtpOverrideIssueUrl } from '../lib/githubDtpOverrideIssueUrl'
import { absoluteUrlFromPath } from '../lib/osmEditorLinks'
import { parseReportRowOsmRef } from '../lib/osmObjectRef'
import { withSiteBasePath } from '../lib/siteBasePath'
import { useDiscussPageLinkParts } from '../lib/useDiscussPageLinkParts'
import type { ComparisonForReport, ReportRow } from '../types/report'

const LINK_CLASS =
  'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

function PageShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-5xl px-4 pt-4 text-left sm:px-6 lg:px-8">{children}</div>
}

function SideCard({
  areaKey,
  row,
  data,
  surfaceClassName,
  children,
}: {
  areaKey: string
  row: ReportRow
  data: ComparisonForReport
  surfaceClassName: string
  children?: ReactNode
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 rounded-lg border p-4 ${surfaceClassName}`}>
      <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
        <ReportCategoryLabel category={row.category} sourceKind={data.sourceKind} />
      </span>
      <span className="text-lg font-semibold text-slate-100">
        {`${data.titlePrefix} ${rowDisplayName(row)}`.trim()}
      </span>
      <span className="font-mono text-xs text-slate-300">{row.canonicalMatchKey}</span>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <Link
          to="/$areaId/feature/$featureKey"
          params={{ areaId: areaKey, featureKey: row.canonicalMatchKey }}
          className={LINK_CLASS}
        >
          {de.compare.openDetail}
        </Link>
        {children}
      </div>
    </div>
  )
}

function CompareContent({
  areaKey,
  officialRow,
  osmRow,
  officialData,
}: {
  areaKey: string
  officialRow: ReportRow
  osmRow: ReportRow
  officialData: FeatureDetailComparison
}) {
  const mapView = useMapViewParam()
  const pairRow = comparePairRow(officialRow, osmRow)
  // Live loads of this page are keyed by the pair, apart from the two detail pages.
  const liveKey = `compare:${officialRow.canonicalMatchKey}:${osmRow.canonicalMatchKey}`
  const liveOsm = useLiveOsmObjects(liveKey)
  const { pageUrlAbsolute } = useDiscussPageLinkParts()
  const liveContext: LiveOsmContext = { featureKey: liveKey, row: pairRow, data: officialData }
  const osmRef = parseReportRowOsmRef(osmRow.osmRelationId)
  const officialPath = featureDiscussPath(areaKey, officialRow.canonicalMatchKey)
  const osmPath = featureDiscussPath(areaKey, osmRow.canonicalMatchKey)
  const compareUrl = absoluteUrlFromPath(
    withSiteBasePath(
      compareDiscussPath(areaKey, officialRow.canonicalMatchKey, osmRow.canonicalMatchKey),
    ),
  )
  const discussBody = de.compare.discussBody(
    compareUrl,
    absoluteUrlFromPath(withSiteBasePath(officialPath)),
    absoluteUrlFromPath(withSiteBasePath(osmPath)),
  )
  const dtpIssueUrl = githubNewDtpOverrideIssueUrl({
    title: compareDiscussPath(areaKey, officialRow.canonicalMatchKey, osmRow.canonicalMatchKey),
    page: pageUrlAbsolute,
    ...dtpCorrectionFormValues(officialRow.officialProperties),
    osmRef: osmObjectText(osmRow.osmRelationId),
  })
  const comparesRegionalKey =
    officialData.filterConfigSummary.osmMatchProperties?.includes('de:regionalschluessel') ?? false

  return (
    <PageShell>
      <div className="flex flex-col gap-10">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="max-w-full min-w-0 flex-[1_1_0] text-2xl font-semibold tracking-tight text-slate-100">
              {`${de.compare.heading}: ${rowDisplayName(officialRow)} ↔ ${rowDisplayName(osmRow)}`}
            </h1>
            <div className="ml-auto flex w-fit max-w-full flex-wrap items-baseline justify-end gap-x-2 text-xs">
              <DiscussDatasetButton
                label={de.compare.discussButton}
                body={discussBody}
                className="inline shrink-0 align-baseline text-xs font-medium text-sky-400 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-300"
              />
              {officialData.sourceKind === 'dtp' ? (
                <a
                  href={dtpIssueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline shrink-0 align-baseline text-xs font-medium text-sky-400 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-300"
                >
                  {de.feature.dtpCorrection.linkLabel}
                </a>
              ) : null}
            </div>
          </div>
          <p className="max-w-4xl text-sm text-slate-400">{de.compare.lead}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <SideCard
              areaKey={areaKey}
              row={officialRow}
              data={officialData}
              surfaceClassName="border-blue-800/60 bg-blue-950/30"
            />
            <SideCard
              areaKey={areaKey}
              row={osmRow}
              data={officialData}
              surfaceClassName="border-orange-800/60 bg-orange-950/25"
            >
              {osmRef ? (
                <>
                  <a
                    href={`https://www.openstreetmap.org/relation/${osmRef.numericId}`}
                    target="_blank"
                    rel="noreferrer"
                    className={LINK_CLASS}
                  >
                    {`relation/${osmRef.numericId}`}
                  </a>
                  {officialData.hasUnmatchedPmtiles ? null : (
                    <LiveOsmObjectLoadButton
                      context={liveContext}
                      object={{ type: 'relation', id: osmRef.numericId }}
                      className={sharedButtonTinyClass}
                    />
                  )}
                </>
              ) : null}
            </SideCard>
          </div>
        </header>

        <DatasetDiscussionAlerts extraPaths={[officialPath, osmPath]} />

        <CompareMapSection
          areaKey={areaKey}
          data={officialData}
          officialRow={officialRow}
          osmRow={osmRow}
          mapBbox={pairRow.mapBbox}
          mapView={mapView}
          overpassGeojson={liveOsm.geojson}
        />

        {comparesRegionalKey ? (
          <CompareKeySegments
            officialKey={officialRow.canonicalMatchKey}
            osmKey={osmRow.canonicalMatchKey}
            officialField={officialData.filterConfigSummary.officialMatchProperty ?? 'ARS'}
            osmField="de:regionalschluessel"
          />
        ) : null}

        <FeatureDatasetProperties
          row={pairRow}
          data={officialData}
          featureKey={liveKey}
          osmTagsLiveOnly
        />

        <UpdateMapInstructions
          areaId={areaKey}
          row={pairRow}
          sourceMetadata={officialData.sourceMetadata}
          sourceKind={officialData.sourceKind}
        />
      </div>
    </PageShell>
  )
}

/**
 * `/$areaId/compare/$officialKey/$osmKey`: an official-only row next to an unmatched OSM row of
 * the same dataset. Built from the data both detail pages load; nothing is generated for it.
 */
export function CompareFeatures() {
  const { areaId: areaKey, officialKey, osmKey } = useParams({ from: COMPARE_ROUTE_FROM })
  const officialQuery = useQuery(featureQueryOptions(areaKey, officialKey))
  const comparisonQuery = useQuery(comparisonQueryOptions(areaKey))

  if (officialQuery.isError || comparisonQuery.isError) {
    return (
      <PageShell>
        <p className="text-red-400">{String(officialQuery.error ?? comparisonQuery.error)}</p>
      </PageShell>
    )
  }
  if (!officialQuery.data || !comparisonQuery.data) {
    return <RouteLoadingPane title={de.routeLoading.compare(officialKey, osmKey)} />
  }

  const officialRow = findFeatureDetailRow(officialQuery.data, officialKey)
  const osmRow = findUnmatchedOsmRow(comparisonQuery.data, osmKey)
  const problems = [
    officialRow?.category === 'official_only' ? null : de.compare.officialNotFound(officialKey),
    osmRow ? null : de.compare.osmNotFound(osmKey),
  ].filter((problem) => problem !== null)
  if (!officialRow || !osmRow || problems.length > 0) {
    return (
      <PageShell>
        <div className="flex flex-col gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <p>{de.compare.invalidPair}</p>
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      </PageShell>
    )
  }

  return (
    <MapProvider>
      <CompareContent
        key={`${areaKey}/${officialKey}/${osmKey}`}
        areaKey={areaKey}
        officialRow={officialRow}
        osmRow={osmRow}
        officialData={officialQuery.data}
      />
    </MapProvider>
  )
}
