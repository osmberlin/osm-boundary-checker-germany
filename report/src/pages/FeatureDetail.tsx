import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  LayerToggleStatBlock,
  StatBlock,
  StatBlocksRow,
  StatRowSpacer,
} from '../components/FeatureStatBlocks'
import {
  AreaDeltaInfoButton,
  HausdorffInfoButton,
  IouInfoButton,
  SymDiffInfoButton,
} from '../components/HausdorffInfoModal'
import { InfoNotice } from '../components/InfoNotice'
import { FeatureDatasetProperties } from '../components/FeatureDatasetProperties'
import { LiveSourceProperties } from '../components/LiveSourceProperties'
import { ReportDataProvenanceFooter } from '../components/ReportDataProvenanceFooter'
import { hexToRgba } from '../components/MapLegend'
import { mapLayerColors } from '../components/mapLayerColors'
import { UpdateMapInstructions } from '../components/UpdateMapInstructions'
import { loadComparison } from '../data/load'
import { comparisonPmtilesMaplibreUrl } from '../data/paths'
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

export function FeatureDetail() {
  const { areaId, featureKey } = useParams<{
    areaId: string
    featureKey: string
  }>()
  const [search] = useSearchParams()
  const snapshot = search.get('snapshot')
  const [data, setData] = useState<ComparisonForReport | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const mapLayers = useComparisonMapLayers()
  const mapViewParam = useMapViewParam()

  useEffect(() => {
    if (!areaId) return
    let c = false
    ;(async () => {
      try {
        const json = await loadComparison(areaId, snapshot)
        if (!c) {
          setData(json)
          setErr(null)
        }
      } catch (e) {
        if (!c) setErr(String(e))
      }
    })()
    return () => {
      c = true
    }
  }, [areaId, snapshot])

  const row = useMemo(() => {
    if (!data || !featureKey) return null
    const key = decodeURIComponent(featureKey)
    return data.rows.find((r) => r.canonicalMatchKey === key) ?? null
  }, [data, featureKey])

  if (!areaId || !featureKey) return null

  if (err) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
        <div className="text-red-400">{err}</div>
      </div>
    )
  }
  if (!data || !row) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
        <p className="text-slate-400">{!data ? de.feature.loading : de.feature.notFound}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
      <StatsStrip row={row} mapLayers={mapLayers} />

      {!data.hasPmtiles ? (
        <InfoNotice className="mt-4">
          {snapshot ? de.map.historicSnapshotNoTiles : de.feature.noPmtiles}
        </InfoNotice>
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
              <ComparisonMapShell
                pmtilesUrl={comparisonPmtilesMaplibreUrl(areaId, snapshot)}
                sourceLayer={data.tippecanoeLayer}
                featureId={row.canonicalMatchKey}
                mapBbox={row.mapBbox}
                urlMapView={mapViewParam.mapView}
                onMoveEndCommitUrl={mapViewParam.commitMapViewFromMap}
                showOfficial={mapLayers.showOfficial}
                showOsm={mapLayers.showOsm}
                showDiff={mapLayers.showDiff}
              />
            </Suspense>
          </div>
        </div>
      )}

      <FeatureDatasetProperties row={row} />

      <LiveSourceProperties data={data} row={row} />

      <UpdateMapInstructions areaId={areaId} row={row} snapshot={snapshot} />

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

      <ReportDataProvenanceFooter data={data} areaId={areaId} snapshot={snapshot} />
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
    <section className="rounded border border-slate-700 bg-slate-900 p-4">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h1 className="font-semibold text-lg tracking-tight text-slate-100">{row.nameLabel}</h1>
        <span className="text-slate-600" aria-hidden>
          ·
        </span>
        <span className="font-mono text-sm text-slate-400">{row.canonicalMatchKey}</span>
        <span className="text-slate-600" aria-hidden>
          ·
        </span>
        <span className="text-sm text-slate-400">{categoryLabelDe(row.category)}</span>
        {row.osmRelationId && (
          <>
            <span className="text-slate-600" aria-hidden>
              ·
            </span>
            <a
              className="text-sm text-sky-400 underline"
              href={`https://www.openstreetmap.org/relation/${row.osmRelationId}`}
              target="_blank"
              rel="noreferrer"
            >
              {de.feature.osmRelation} {row.osmRelationId}
            </a>
          </>
        )}
      </div>

      {m && (
        <>
          <StatBlocksRow className="mt-6 sm:mt-8" aria-label={s.diffMetricsRowAria}>
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
                  className="h-5 w-10 shrink-0 rounded-sm border-2 border-slate-500 border-solid"
                  style={{
                    background: `linear-gradient(90deg, ${hexToRgba(d.official.fill, d.official.fillOpacity)} 50%, ${hexToRgba(d.osm.fill, d.osm.fillOpacity)} 50%)`,
                  }}
                  aria-hidden
                />
              }
            />
            <StatRowSpacer />
          </StatBlocksRow>
        </>
      )}
      {!m && <p className="mt-4 text-amber-400 text-sm">{de.feature.noMetrics}</p>}
    </section>
  )
}
