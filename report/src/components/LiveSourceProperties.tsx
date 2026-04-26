import { useCallback, useState } from 'react'
import { de } from '../i18n/de'
import {
  buildOverpassBoundaryQuery,
  fetchOverpassQuery,
  type OverpassBoundaryHit,
  parseOverpassBoundaryElements,
} from '../lib/overpassBbox'
import { DEFAULT_OVERPASS_INTERPRETER_URL, OVERPASS_INSTANCES } from '../lib/overpassServers'
import { buildWfsGetFeatureUrl, fetchWfsGetFeature, padMapBbox } from '../lib/wfsGetFeature'
import type { ComparisonForReport, OgcWfsInspectSource, ReportRow } from '../types/report'
import { sharedButtonClass } from './sharedButtonStyles'

type GeoJsonFeature = {
  type: 'Feature'
  id?: string | number
  properties: Record<string, unknown> | null
}

type GeoJsonFc = {
  type?: string
  features?: GeoJsonFeature[]
}

type OfficialSlot =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; features: GeoJsonFeature[] }

type OsmSlot =
  | { status: 'idle' }
  | { status: 'confirm'; queryDraft: string; interpreterUrl: string; lastError?: string }
  | { status: 'loading' }
  | { status: 'done'; hits: OverpassBoundaryHit[] }

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function parseFeatureCollection(text: string): GeoJsonFeature[] {
  const data = JSON.parse(text) as GeoJsonFc
  if (!data || !Array.isArray(data.features)) {
    throw new Error(de.feature.liveOfficialInvalidJson)
  }
  return data.features.filter((f) => f?.type === 'Feature')
}

function PropertyCard({
  title,
  properties,
  variant,
}: {
  title: string
  properties: Record<string, unknown>
  variant: 'official' | 'osm'
}) {
  const entries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b, 'de'))
  const shell =
    variant === 'official' ? 'border-blue-900/50 bg-blue-950/18' : 'border-red-900/45 bg-red-950/18'
  const bar = variant === 'official' ? 'border-l-blue-400/45' : 'border-l-red-400/45'

  return (
    <article className={`rounded-lg border border-l-[3px] ${bar} ${shell} p-3 shadow-sm`}>
      <h3 className="mb-2 text-sm/6 font-medium text-slate-100">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">{de.feature.liveOsmHitNoTags}</p>
      ) : (
        <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-xs break-words text-slate-400">{k}</dt>
              <dd className="break-words text-slate-100">{formatPropertyValue(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}

function sortOverpassHits(a: OverpassBoundaryHit, b: OverpassBoundaryHit): number {
  const o = (t: string) => (t === 'relation' ? 0 : t === 'way' ? 1 : 2)
  const c = o(a.type) - o(b.type)
  if (c !== 0) return c
  return a.id - b.id
}

/** Drop `name:de`, `name:en`, … from Overpass tag listings (noise for matching keys). */
function withoutNameStarTags(tags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tags)) {
    if (k.startsWith('name:')) continue
    out[k] = v
  }
  return out
}

export function LiveSourceProperties({ data, row }: { data: ComparisonForReport; row: ReportRow }) {
  const sources = data.ogcInspectSources ?? []
  const bbox = row.mapBbox ? padMapBbox(row.mapBbox) : null
  const overpassBoundaryTag = data.overpassBoundaryTag ?? 'administrative'

  const [officialById, setOfficialById] = useState<Record<string, OfficialSlot>>({})
  const [osm, setOsm] = useState<OsmSlot>({ status: 'idle' })

  const loadOfficial = useCallback(
    async (src: OgcWfsInspectSource) => {
      if (!bbox) return
      setOfficialById((prev) => ({ ...prev, [src.id]: { status: 'loading' } }))
      try {
        const url = buildWfsGetFeatureUrl(src, bbox)
        const res = await fetchWfsGetFeature(url)
        const text = await res.text()
        if (!res.ok) {
          throw new Error(`${de.feature.liveOfficialHttp} ${res.status}`)
        }
        const features = parseFeatureCollection(text)
        setOfficialById((prev) => ({
          ...prev,
          [src.id]: { status: 'done', features },
        }))
      } catch (e) {
        setOfficialById((prev) => ({
          ...prev,
          [src.id]: {
            status: 'error',
            message: e instanceof Error ? e.message : String(e),
          },
        }))
      }
    },
    [bbox],
  )

  const runOverpass = useCallback(async (query: string, interpreterUrl: string) => {
    const q = query.trim()
    setOsm({ status: 'loading' })
    try {
      const res = await fetchOverpassQuery(q, interpreterUrl)
      const text = await res.text()
      if (!res.ok) {
        throw new Error(`${de.feature.liveOsmHttp} ${res.status}`)
      }
      let hits: OverpassBoundaryHit[]
      try {
        hits = parseOverpassBoundaryElements(text)
      } catch (e) {
        if (e instanceof Error && e.message === 'INVALID_OVERPASS_JSON') {
          throw new Error(de.feature.liveOsmInvalidJson)
        }
        throw e
      }
      hits.sort(sortOverpassHits)
      setOsm({ status: 'done', hits })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setOsm({
        status: 'confirm',
        queryDraft: query,
        interpreterUrl,
        lastError: message,
      })
    }
  }, [])

  const showOfficial = sources.length > 0
  const showOsm = bbox != null
  if (!showOfficial && !showOsm) return null

  return (
    <section
      className="mt-10 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={de.feature.liveSourcesSectionAria}
    >
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">
          {de.feature.liveSourcesSectionTitle}
        </h2>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">{de.feature.liveSourcesSectionLead}</p>
      </div>

      <div className="border-t border-slate-700">
        <dl className="divide-y divide-slate-700/80">
          {showOfficial && (
            <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
              <dt>
                <h3 className="text-sm/6 font-medium text-slate-200">
                  {de.feature.liveOfficialHeading}
                </h3>
              </dt>
              <dd className="mt-2 space-y-4 md:col-span-2 md:mt-0">
                {!bbox && (
                  <p className="text-sm text-amber-300/90">{de.feature.liveOfficialNoBbox}</p>
                )}
                {sources.map((src) => {
                  const slot = officialById[src.id] ?? { status: 'idle' as const }
                  return (
                    <div key={src.id} className="space-y-2">
                      <button
                        type="button"
                        disabled={!bbox || slot.status === 'loading'}
                        onClick={() => void loadOfficial(src)}
                        className={sharedButtonClass}
                      >
                        {slot.status === 'loading'
                          ? de.feature.liveOfficialLoading
                          : `${de.feature.liveOfficialLoad}: ${src.label}`}
                      </button>
                      {slot.status === 'error' && (
                        <p className="text-sm text-red-400">{slot.message}</p>
                      )}
                      {slot.status === 'done' && slot.features.length === 0 && (
                        <p className="text-sm text-slate-400">{de.feature.liveOfficialEmpty}</p>
                      )}
                      {slot.status === 'done' && slot.features.length > 0 && (
                        <div className="space-y-3">
                          {slot.features.map((f, i) => {
                            const props = f.properties ?? {}
                            const idPart = f.id != null ? String(f.id) : String(i + 1)
                            return (
                              <PropertyCard
                                key={`${src.id}-${idPart}`}
                                title={de.feature.liveOfficialFeatureTitle(i + 1, idPart)}
                                properties={props}
                                variant="official"
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </dd>
            </div>
          )}

          {showOsm && (
            <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
              <dt>
                <h3 className="text-sm/6 font-medium text-slate-200">
                  {de.feature.liveOsmHeading}
                </h3>
              </dt>
              <dd className="mt-2 space-y-3 md:col-span-2 md:mt-0">
                {osm.status === 'idle' && bbox && (
                  <button
                    type="button"
                    onClick={() =>
                      setOsm({
                        status: 'confirm',
                        queryDraft: buildOverpassBoundaryQuery(bbox, overpassBoundaryTag),
                        interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
                      })
                    }
                    className={sharedButtonClass}
                  >
                    {de.feature.liveOsmLoad}
                  </button>
                )}

                {osm.status === 'confirm' && (
                  <div
                    className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3"
                    role="dialog"
                    aria-labelledby="overpass-confirm-title"
                  >
                    <p id="overpass-confirm-title" className="text-sm font-medium text-amber-100">
                      {de.feature.liveOsmOverpassWarnTitle}
                    </p>
                    <p className="mt-2 text-sm text-amber-200/90">
                      {de.feature.liveOsmOverpassWarnLead}
                    </p>
                    <p className="mt-1 text-sm font-medium text-amber-100">
                      {de.feature.liveOsmOverpassWarnScope}
                    </p>
                    {osm.lastError != null && osm.lastError !== '' && (
                      <div
                        className="mt-3 rounded-md border border-red-900/60 bg-red-950/35 px-3 py-2 text-sm text-red-100"
                        role="alert"
                      >
                        <p className="font-medium">{de.feature.liveOsmLastErrorTitle}</p>
                        <p className="mt-1 break-words whitespace-pre-wrap">{osm.lastError}</p>
                        <p className="mt-2 text-xs text-red-200/85">
                          {de.feature.liveOsmLastErrorHint}
                        </p>
                      </div>
                    )}
                    <label
                      htmlFor="overpass-server"
                      className="mt-3 block text-xs font-medium tracking-wide text-slate-400 uppercase"
                    >
                      {de.feature.liveOsmServerLabel}
                    </label>
                    <select
                      id="overpass-server"
                      value={osm.interpreterUrl}
                      onChange={(e) =>
                        setOsm({
                          status: 'confirm',
                          queryDraft: osm.queryDraft,
                          interpreterUrl: e.target.value,
                        })
                      }
                      className="mt-1 block w-full max-w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-100 shadow-sm focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 focus:outline-none"
                    >
                      {OVERPASS_INSTANCES.map((inst) => (
                        <option key={inst.interpreterUrl} value={inst.interpreterUrl}>
                          {inst.interpreterUrl}
                        </option>
                      ))}
                    </select>
                    <label
                      htmlFor="overpass-query-draft"
                      className="mt-3 block text-xs font-medium tracking-wide text-slate-400 uppercase"
                    >
                      {de.feature.liveOsmOverpassWarnQuery}
                    </label>
                    <textarea
                      id="overpass-query-draft"
                      value={osm.queryDraft}
                      onChange={(e) =>
                        setOsm({
                          status: 'confirm',
                          queryDraft: e.target.value,
                          interpreterUrl: osm.interpreterUrl,
                        })
                      }
                      spellCheck={false}
                      rows={10}
                      className="mt-1 max-h-64 min-h-[8rem] w-full resize-y rounded border border-slate-600 bg-slate-950 p-2 font-mono text-[11px] leading-snug text-slate-200 shadow-inner focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 focus:outline-none"
                    />
                    {bbox && (
                      <button
                        type="button"
                        onClick={() =>
                          setOsm({
                            status: 'confirm',
                            queryDraft: buildOverpassBoundaryQuery(bbox, overpassBoundaryTag),
                            interpreterUrl: osm.interpreterUrl,
                          })
                        }
                        className="mt-2 text-xs text-amber-200/85 underline decoration-amber-400/35 underline-offset-2 hover:text-amber-100"
                      >
                        {de.feature.liveOsmQueryReset}
                      </button>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setOsm({ status: 'idle' })}
                        className={sharedButtonClass}
                      >
                        {de.feature.liveOsmConfirmNo}
                      </button>
                      <button
                        type="button"
                        disabled={osm.queryDraft.trim() === ''}
                        onClick={() => void runOverpass(osm.queryDraft, osm.interpreterUrl)}
                        className={sharedButtonClass}
                      >
                        {de.feature.liveOsmConfirmYes}
                      </button>
                    </div>
                  </div>
                )}

                {osm.status === 'loading' && (
                  <p className="text-sm text-slate-400">{de.feature.liveOsmLoading}</p>
                )}

                {osm.status === 'done' && osm.hits.length === 0 && (
                  <p className="text-sm text-slate-400">{de.feature.liveOsmEmpty}</p>
                )}

                {osm.status === 'done' && osm.hits.length > 0 && (
                  <div className="space-y-3">
                    {osm.hits.map((hit) => (
                      <PropertyCard
                        key={`${hit.type}-${hit.id}`}
                        title={de.feature.liveOsmHitTitle(hit.type, hit.id)}
                        properties={withoutNameStarTags(hit.tags) as Record<string, unknown>}
                        variant="osm"
                      />
                    ))}
                  </div>
                )}

                {osm.status === 'done' && (
                  <button
                    type="button"
                    onClick={() => setOsm({ status: 'idle' })}
                    className="text-sm text-red-300/90 underline decoration-red-400/30 underline-offset-2 hover:text-red-200"
                  >
                    {de.feature.liveOsmAgain}
                  </button>
                )}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  )
}
