import { parseAsString, useQueryState } from 'nuqs'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InfoNotice } from '../components/InfoNotice'
import { ReportDataProvenanceFooter } from '../components/ReportDataProvenanceFooter'
import { loadComparison } from '../data/load'
import { comparisonUnmatchedPmtilesMaplibreUrl } from '../data/paths'
import { useMapViewParam } from '../hooks/useMapViewParam'
import { de } from '../i18n/de'
import { EM_DASH, formatDeInteger } from '../lib/formatDe'
import type { ComparisonForReport, UnmatchedOsmReportRow } from '../types/report'

const ComparisonMapShell = lazy(() => import('../components/map/ComparisonMapShell'))

function unionMapBboxes(rows: UnmatchedOsmReportRow[]): [number, number, number, number] | null {
  const boxes = rows
    .map((r) => r.mapBbox)
    .filter((b): b is [number, number, number, number] => b != null)
  if (boxes.length === 0) return null
  const first = boxes[0]
  if (!first) return null
  let w = first[0]
  let s = first[1]
  let e = first[2]
  let n = first[3]
  for (let i = 1; i < boxes.length; i++) {
    const b = boxes[i]
    if (!b) continue
    w = Math.min(w, b[0])
    s = Math.min(s, b[1])
    e = Math.max(e, b[2])
    n = Math.max(n, b[3])
  }
  if (!(w < e && s < n)) return null
  return [w, s, e, n]
}

export function UnmatchedReport() {
  const { areaId } = useParams<{ areaId: string }>()
  const [snapshot] = useQueryState('snapshot', parseAsString.withDefault(''))
  const [data, setData] = useState<ComparisonForReport | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const mapViewParam = useMapViewParam()
  const snapParam = snapshot || null

  useEffect(() => {
    if (!areaId) return
    let cancelled = false
    ;(async () => {
      try {
        const json = await loadComparison(areaId, snapParam || undefined)
        if (!cancelled) {
          setData(json)
          setErr(null)
        }
      } catch (e) {
        if (!cancelled) setErr(String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [areaId, snapParam])

  const unmatched = data?.unmatchedOsm ?? []
  const overviewMapBbox = useMemo(
    () => unionMapBboxes(data?.unmatchedOsm ?? []),
    [data?.unmatchedOsm],
  )

  if (!areaId) return null

  const areaHref =
    snapParam != null && snapParam !== ''
      ? `/${areaId}?snapshot=${encodeURIComponent(snapParam)}`
      : `/${areaId}`

  if (err) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-4 text-left sm:px-6 lg:px-8">
        <p className="text-red-400">{err}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-4 text-left sm:px-6 lg:px-8">
        <p className="text-slate-400">…</p>
      </div>
    )
  }

  const showMap = data.hasUnmatchedPmtiles === true && unmatched.length > 0 && !snapParam

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 text-left sm:px-6 lg:px-8">
      <h1 className="mb-4 font-semibold text-xl text-slate-100">{de.unmatched.title}</h1>
      <p className="mb-4 text-slate-400">{de.unmatched.lead}</p>
      <p className="mb-6 text-sm text-slate-400">
        {de.areaReport.unmatchedCountLabel}: {formatDeInteger(unmatched.length)}
      </p>
      {snapParam ? <InfoNotice className="mb-6">{de.unmatched.mapOnlyLatest}</InfoNotice> : null}
      <p className="mb-6">
        <Link className="text-sky-400 underline" to={areaHref}>
          {de.unmatched.backToArea}
        </Link>
      </p>

      {unmatched.length === 0 ? (
        <p className="text-slate-400">{de.unmatched.noData}</p>
      ) : (
        <>
          {showMap ? (
            <div className="mb-8 w-full overflow-hidden rounded border border-slate-700">
              <div className="h-[420px] w-full">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-slate-500">…</div>
                  }
                >
                  <ComparisonMapShell
                    pmtilesUrl={comparisonUnmatchedPmtilesMaplibreUrl(areaId)}
                    sourceLayer={data.tippecanoeLayer}
                    featureId={null}
                    allowedFeatureIds={null}
                    mapBbox={overviewMapBbox}
                    urlMapView={mapViewParam.mapView}
                    onMoveEndCommitUrl={mapViewParam.commitMapViewFromMap}
                    showOfficial={false}
                    showOsm
                    showDiff={false}
                  />
                </Suspense>
              </div>
            </div>
          ) : unmatched.length > 0 ? (
            <InfoNotice className="mb-6">{de.unmatched.noPmtiles}</InfoNotice>
          ) : null}

          <div className="overflow-x-auto rounded border border-slate-700">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-3 py-2 text-left text-slate-100">{de.unmatched.tableKey}</th>
                  <th className="px-3 py-2 text-left text-slate-100">{de.unmatched.tableName}</th>
                  <th className="px-3 py-2 text-left text-slate-100">
                    {de.unmatched.tableAdminLevel}
                  </th>
                  <th className="px-3 py-2 text-left text-slate-100">
                    {de.unmatched.tableRelation}
                  </th>
                </tr>
              </thead>
              <tbody>
                {unmatched.map((row) => (
                  <tr key={row.canonicalMatchKey} className="border-slate-800 border-t">
                    <td className="px-3 py-2 font-mono text-xs text-slate-100">
                      {row.canonicalMatchKey}
                    </td>
                    <td className="px-3 py-2 text-slate-100">{row.nameLabel}</td>
                    <td className="px-3 py-2 text-slate-100">{row.adminLevel ?? EM_DASH}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-100">
                      {row.osmRelationId ? (
                        <a
                          className="text-sky-400 underline"
                          href={`https://www.openstreetmap.org/relation/${row.osmRelationId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {row.osmRelationId}
                        </a>
                      ) : (
                        EM_DASH
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ReportDataProvenanceFooter
        data={data}
        areaId={areaId}
        snapshot={snapParam}
        hideUnmatchedCrossLink
      />
    </div>
  )
}
