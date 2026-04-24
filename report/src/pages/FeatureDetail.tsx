import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { lazy, Suspense, useId } from 'react'
import { MapProvider } from 'react-map-gl/maplibre'
import { FeatureDatasetProperties } from '../components/FeatureDatasetProperties'
import { LayerToggleStatBlock, StatBlock, StatBlocksRow } from '../components/FeatureStatBlocks'
import {
  AreaDeltaInfoButton,
  HausdorffInfoButton,
  IouInfoButton,
  SymDiffInfoButton,
} from '../components/HausdorffInfoModal'
import { InfoNotice } from '../components/InfoNotice'
import { LiveSourceProperties } from '../components/LiveSourceProperties'
import { mapLayerColors } from '../components/mapLayerColors'
import { hexToRgba } from '../components/MapLegend'
import { ReportDataProvenanceFooter } from '../components/ReportDataProvenanceFooter'
import { UpdateMapInstructions } from '../components/UpdateMapInstructions'
import { featureQueryOptions } from '../data/load'
import { comparisonPmtilesMaplibreUrl, comparisonUnmatchedPmtilesMaplibreUrl } from '../data/paths'
import { useComparisonMapLayers } from '../hooks/useComparisonMapLayers'
import { useMapViewParam } from '../hooks/useMapViewParam'
import { categoryLabelDe, de } from '../i18n/de'
import {
  formatDeIou,
  formatDeMeters,
  formatDeOrDash,
  formatDePercentPoints,
  formatDeSquareKilometersFromM2,
} from '../lib/formatDe'
import type { ComparisonForReport, ReportRow } from '../types/report'

const ComparisonMapShell = lazy(() => import('../components/map/ComparisonMapShell'))

type MapLayerControls = ReturnType<typeof useComparisonMapLayers>

function normalizeUnmatchedRows(data: ComparisonForReport): ReportRow[] {
  return data.unmatchedOsm.map((row) => ({
    canonicalMatchKey: row.canonicalMatchKey,
    nameLabel: row.nameLabel,
    category: 'unmatched_osm',
    osmRelationId: row.osmRelationId,
    metrics: null,
    mapBbox: row.mapBbox,
    officialForEditPath: null,
    officialProperties: null,
    osmProperties: null,
  }))
}

function findRow(data: ComparisonForReport, featureKey: string): ReportRow | null {
  const inMain = data.rows.find((row) => row.canonicalMatchKey === featureKey)
  if (inMain) return inMain
  return normalizeUnmatchedRows(data).find((row) => row.canonicalMatchKey === featureKey) ?? null
}

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
  const data: ComparisonForReport | null = featureQuery.data ?? null

  const row = !data || !featureKey ? null : findRow(data, featureKey)
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

  const hasRowMapTiles =
    row.category === 'unmatched_osm' ? data.hasUnmatchedPmtiles === true : data.hasPmtiles

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
      <StatsStrip row={row} mapLayers={mapLayers} />

      {!hasRowMapTiles ? (
        <InfoNotice className="mt-4">{de.feature.noPmtiles}</InfoNotice>
      ) : (
        <div className="mt-4 w-full overflow-hidden rounded border border-slate-700">
          <div className="h-[480px] w-full">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-slate-500">
                  {de.feature.loadingMap}
                </div>
              }
            >
              <MapProvider>
                <ComparisonMapShell
                  sources={{
                    primary: {
                      pmtilesUrl: comparisonPmtilesMaplibreUrl(areaKey),
                      sourceLayer: data.tippecanoeLayer,
                    },
                    unmatched: data.hasUnmatchedPmtiles
                      ? {
                          pmtilesUrl: comparisonUnmatchedPmtilesMaplibreUrl(areaKey),
                          sourceLayer: data.tippecanoeLayer,
                          visible: row.category === 'unmatched_osm',
                        }
                      : undefined,
                  }}
                  view={{
                    featureId: row.canonicalMatchKey,
                    mapBbox: row.mapBbox,
                    urlMapView: mapViewParam.mapView,
                    onMoveEndCommitUrl: mapViewParam.commitMapViewFromMap,
                  }}
                  layers={{
                    showOfficial: row.category === 'unmatched_osm' ? false : mapLayers.showOfficial,
                    showOsm: row.category === 'unmatched_osm' ? false : mapLayers.showOsm,
                    showDiff: row.category === 'unmatched_osm' ? false : mapLayers.showDiff,
                  }}
                />
              </MapProvider>
            </Suspense>
          </div>
        </div>
      )}

      <FeatureDatasetProperties row={row} />

      <LiveSourceProperties data={data} row={row} />

      <UpdateMapInstructions areaId={areaKey} row={row} />

      {row.metrics && (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-xs text-slate-400">
          <span>{de.feature.stats.footnote.metricsCrsLine(data.metricsCrs)}</span>
          <span className="text-slate-600" aria-hidden>
            ·
          </span>
          <a
            className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
            href={de.feature.stats.footnote.hausdorffDoc.href}
            target="_blank"
            rel="noreferrer"
            title={de.feature.stats.footnote.hausdorffDoc.title}
          >
            {de.feature.stats.footnote.hausdorffDoc.label}
          </a>
        </p>
      )}

      <ReportDataProvenanceFooter data={data} />
    </div>
  )
}

function symmetricDiffAreaM2(m: NonNullable<ReportRow['metrics']>): number {
  return m.officialAreaM2 * (m.symmetricDiffPct / 100)
}

function StatsStrip({ row, mapLayers }: { row: ReportRow; mapLayers: MapLayerControls }) {
  const m = row.metrics
  const s = de.feature.stats
  const layerId = useId()
  const o = mapLayerColors.official
  const osmC = mapLayerColors.osm
  const d = mapLayerColors.diff

  return (
    <>
      <div className="mb-6 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-slate-100">
          {row.nameLabel}
        </h1>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-slate-500 sm:justify-end">
          <span className="font-mono">{row.canonicalMatchKey}</span>
          <span className="text-slate-600" aria-hidden>
            ·
          </span>
          <span>{categoryLabelDe(row.category)}</span>
          {row.osmRelationId && (
            <>
              <span className="text-slate-600" aria-hidden>
                ·
              </span>
              <a
                className="text-slate-400 underline decoration-slate-500/60 underline-offset-2 hover:text-slate-300"
                href={`https://www.openstreetmap.org/relation/${row.osmRelationId}`}
                target="_blank"
                rel="noreferrer"
              >
                {de.feature.osmRelation} {row.osmRelationId}
              </a>
            </>
          )}
        </div>
      </div>

      <section className="rounded border border-slate-700 bg-slate-900 p-4">
        {m && (
          <>
            <StatBlocksRow
              className="mt-0 flex-wrap gap-y-4 lg:flex-nowrap lg:gap-y-0 [&>*]:basis-1/2 lg:[&>*]:basis-0 lg:[&>*:first-child]:border-l-0 lg:[&>*:first-child]:pl-0 [&>*:nth-child(odd)]:border-l-0 [&>*:nth-child(odd)]:pl-0 lg:[&>*:nth-child(odd)]:border-l lg:[&>*:nth-child(odd)]:pl-6"
              aria-label={s.diffMetricsRowAria}
            >
              <StatBlock
                label={
                  <span className="inline-flex items-center gap-0.5">
                    <span>{s.iou}</span>
                    <IouInfoButton />
                  </span>
                }
                value={formatDeIou(m.iou)}
              />
              <StatBlock
                label={
                  <span className="inline-flex items-center gap-0.5">
                    <span>{s.areaDelta}</span>
                    <AreaDeltaInfoButton />
                  </span>
                }
                value={formatDePercentPoints(m.areaDiffPct)}
              />
              <StatBlock
                label={
                  <span className="inline-flex items-center gap-0.5">
                    <span>{s.symDiff}</span>
                    <SymDiffInfoButton />
                  </span>
                }
                value={formatDePercentPoints(m.symmetricDiffPct)}
              />
              <StatBlock
                label={
                  <span className="inline-flex items-center gap-0.5">
                    <span>{s.hausdorff}</span>
                    <HausdorffInfoButton />
                  </span>
                }
                value={formatDeOrDash(m.hausdorffM, formatDeMeters)}
              />
            </StatBlocksRow>

            <StatBlocksRow className="mt-10 sm:mt-12 lg:mt-14" aria-label={s.layersRowAria}>
              <LayerToggleStatBlock
                inputId={`${layerId}-official`}
                checked={mapLayers.showOfficial}
                onChange={mapLayers.setShowOfficial}
                label={s.areaOfficial}
                value={formatDeSquareKilometersFromM2(m.officialAreaM2)}
                swatch={
                  <div
                    className="h-5 w-10 shrink-0 rounded-sm border-2 border-solid"
                    style={{
                      borderColor: o.line,
                      backgroundColor: hexToRgba(o.fill, o.fillOpacity),
                    }}
                    aria-hidden
                  />
                }
              />
              <LayerToggleStatBlock
                inputId={`${layerId}-osm`}
                checked={mapLayers.showOsm}
                onChange={mapLayers.setShowOsm}
                label={s.areaOsm}
                value={formatDeSquareKilometersFromM2(m.osmAreaM2)}
                swatch={
                  <div
                    className="h-5 w-10 shrink-0 rounded-sm border-2 border-solid"
                    style={{
                      borderColor: osmC.line,
                      backgroundColor: hexToRgba(osmC.fill, osmC.fillOpacity),
                    }}
                    aria-hidden
                  />
                }
              />
              <LayerToggleStatBlock
                inputId={`${layerId}-diff`}
                checked={mapLayers.showDiff}
                onChange={mapLayers.setShowDiff}
                label={de.map.diff}
                value={formatDeSquareKilometersFromM2(symmetricDiffAreaM2(m))}
                swatch={
                  <div
                    className="h-5 w-10 shrink-0 rounded-sm border-2 border-solid border-slate-500"
                    style={{
                      background: `linear-gradient(90deg, ${hexToRgba(d.official.fill, d.official.fillOpacity)} 50%, ${hexToRgba(d.osm.fill, d.osm.fillOpacity)} 50%)`,
                    }}
                    aria-hidden
                  />
                }
              />
            </StatBlocksRow>
          </>
        )}
        {!m && <p className="text-sm text-amber-400">{de.feature.noMetrics}</p>}
      </section>
    </>
  )
}
