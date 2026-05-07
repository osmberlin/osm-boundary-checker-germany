import { useCallback, useState } from 'react'
import { de } from '../i18n/de'
import { cn } from '../lib/cn'
import {
  germanKeyExplorerLinkValueOrNull,
  isGermanKeyExplorerDisplayKey,
} from '../lib/germanKeyExplorer'
import { buildOverpassBoundaryQuery, type OverpassBoundaryHit } from '../lib/overpassBbox'
import { DEFAULT_OVERPASS_INTERPRETER_URL, OVERPASS_INSTANCES } from '../lib/overpassServers'
import { padMapBbox, type WfsFeature } from '../lib/wfsGetFeature'
import type { ComparisonForReport, OgcWfsInspectSource, ReportRow } from '../types/report'
import { GermanKeyVerifyLink } from './GermanKeyVerifyLink'
import { mapLayerColors } from './mapLayerColors'
import { sharedButtonClass } from './sharedButtonStyles'

type OfficialSlot =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; features: WfsFeature[] }

type OsmSlot =
  | { status: 'idle' }
  | { status: 'confirm'; queryDraft: string; interpreterUrl: string; lastError?: string }
  | { status: 'loading' }
  | { status: 'done' }

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return de.feature.datasetPropertiesEmpty
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Same key filtering as dataset property cards (`@id` is redundant with OSM identity elsewhere). */
function datasetPropsForMatch(
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!props) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (k === '@id') continue
    out[k] = v
  }
  return out
}

/** Values displayed as placeholders in VG250-style extracts should not light up live rows. */
function isExcludedDatasetMatchToken(s: string): boolean {
  if (s === '') return true
  if (s === de.feature.datasetPropertiesEmpty) return true
  if (s.toUpperCase() === 'NAN') return true
  return /^-+$/.test(s)
}

function buildDatasetSnapshotValueMatchSet(row: ReportRow): ReadonlySet<string> {
  const set = new Set<string>()
  for (const block of [
    datasetPropsForMatch(row.officialProperties),
    datasetPropsForMatch(row.osmProperties),
  ]) {
    for (const v of Object.values(block)) {
      const s = formatPropertyValue(v).trim()
      if (!isExcludedDatasetMatchToken(s)) set.add(s)
    }
  }
  return set
}

function PropertyCard({
  title,
  properties,
  variant,
  osmBrowseLink,
  germanKeyContext,
  datasetSnapshotValueMatches,
}: {
  title: string
  properties: Record<string, unknown>
  variant: 'official' | 'osm'
  /** When set (Overpass hit), the title links to osm.org for this object. */
  osmBrowseLink?: { type: string; id: number }
  germanKeyContext?: { data: ComparisonForReport }
  /** Serialized values from VG250/OSM snapshot cards; matching live rows use Overpass magenta. */
  datasetSnapshotValueMatches?: ReadonlySet<string>
}) {
  const entries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b, 'de'))
  const color = variant === 'official' ? mapLayerColors.wfs : mapLayerColors.overpass
  const keyText = variant === 'official' ? 'text-slate-400' : 'text-violet-200/75'
  const valueText = variant === 'official' ? 'text-slate-100' : 'text-violet-100'
  const verifyLinkClass =
    'shrink-0 text-xs font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'
  const cardStyle = {
    borderColor: color.line,
    backgroundColor:
      variant === 'official'
        ? `rgb(76 29 149 / ${mapLayerColors.wfs.fillOpacity})`
        : `rgb(112 26 117 / ${mapLayerColors.overpass.fillOpacity})`,
  } satisfies React.CSSProperties

  return (
    <article className="rounded-lg border p-3 shadow-sm" style={cardStyle}>
      <h3 className="mb-2 text-sm/6 font-medium text-slate-100">
        {osmBrowseLink ? (
          <a
            href={`https://www.openstreetmap.org/${osmBrowseLink.type}/${osmBrowseLink.id}`}
            target="_blank"
            rel="noreferrer noopener"
            title={de.feature.updateMap.opensInNewWindowTitle}
            className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
          >
            {title}
          </a>
        ) : (
          title
        )}
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">{de.feature.liveOsmHitNoTags}</p>
      ) : (
        <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {entries.map(([k, v]) => {
            const linkVal =
              germanKeyContext &&
              isGermanKeyExplorerDisplayKey(k) &&
              (typeof v === 'string' || typeof v === 'number')
                ? germanKeyExplorerLinkValueOrNull(v)
                : null
            const displayValue = formatPropertyValue(v)
            const matchesSnapshot = datasetSnapshotValueMatches?.has(displayValue.trim()) ?? false
            return (
              <div key={k} className="contents">
                <dt className={`font-mono text-xs break-words ${keyText}`}>{k}</dt>
                <dd className={`min-w-0 break-words ${valueText}`}>
                  <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span
                      className={cn(
                        'min-w-0 rounded-sm text-inherit',
                        /* mapLayerColors.overpass: fill #701a75, line #86198f → fuchsia-900/800 */
                        matchesSnapshot && 'bg-fuchsia-800 outline outline-4 outline-fuchsia-800',
                      )}
                    >
                      {displayValue}
                    </span>
                    {linkVal && germanKeyContext ? (
                      <GermanKeyVerifyLink keyValue={linkVal} className={verifyLinkClass} />
                    ) : null}
                  </span>
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </article>
  )
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

export function LiveSourceProperties({
  data,
  row,
  wfs,
  overpass,
}: {
  data: ComparisonForReport
  row: ReportRow
  wfs: {
    load: (source: OgcWfsInspectSource, bbox: [number, number, number, number]) => Promise<void>
    getStatus: (sourceId: string) => OfficialSlot
  }
  overpass: {
    hits: OverpassBoundaryHit[]
    run: (query: string, interpreterUrl: string) => Promise<void>
    reset: () => void
  }
}) {
  const sources = data.ogcInspectSources ?? []
  const bbox = row.mapBbox ? padMapBbox(row.mapBbox) : null
  const overpassBoundaryTag = data.overpassBoundaryTag ?? 'administrative'

  const datasetSnapshotValueMatches = buildDatasetSnapshotValueMatchSet(row)

  const [osm, setOsm] = useState<OsmSlot>({ status: 'idle' })
  const osmHits = overpass.hits

  const loadOfficial = useCallback(
    async (src: OgcWfsInspectSource) => {
      if (!bbox) return
      await wfs.load(src, bbox)
    },
    [bbox, wfs],
  )

  const runOverpass = useCallback(
    async (query: string, interpreterUrl: string) => {
      const q = query.trim()
      setOsm({ status: 'loading' })
      try {
        await overpass.run(q, interpreterUrl)
        setOsm({ status: 'done' })
      } catch (e) {
        const rawMessage = e instanceof Error ? e.message : String(e)
        const message =
          rawMessage === 'INVALID_OVERPASS_JSON'
            ? de.feature.liveOsmInvalidJson
            : rawMessage.startsWith('Overpass request failed:')
              ? `${de.feature.liveOsmHttp} ${rawMessage.replace('Overpass request failed:', '').trim()}`
              : rawMessage
        setOsm({
          status: 'confirm',
          queryDraft: query,
          interpreterUrl,
          lastError: message,
        })
      }
    },
    [overpass],
  )

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
                  const slot = wfs.getStatus(src.id)
                  const officialErrorMessage =
                    slot.status === 'error' && slot.message === 'INVALID_WFS_XML'
                      ? de.feature.liveOfficialInvalidJson
                      : slot.status === 'error' &&
                          slot.message.includes("output/input format 'application/json'")
                        ? de.feature.liveOfficialUnsupportedFormat
                        : slot.status === 'error' && slot.message.startsWith('WFS request failed:')
                          ? `${de.feature.liveOfficialHttp} ${slot.message.replace('WFS request failed:', '').trim()}`
                          : slot.status === 'error'
                            ? slot.message
                            : null
                  return (
                    <div key={src.id} className="space-y-2">
                      {slot.status !== 'done' && (
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
                      )}
                      {slot.status === 'error' && officialErrorMessage && (
                        <p className="text-sm text-red-400">{officialErrorMessage}</p>
                      )}
                      {slot.status === 'done' && slot.features.length === 0 && (
                        <p className="text-sm text-slate-400">{de.feature.liveOfficialEmpty}</p>
                      )}
                      {slot.status === 'done' && slot.features.length > 0 && (
                        <div className="space-y-3">
                          {slot.features.map((f, i) => {
                            const props = f.properties ?? {}
                            const idPart = f.id != null ? String(f.id) : String(i + 1)
                            const title =
                              f.id != null ? idPart : de.feature.liveOfficialFeatureTitle(i + 1, '')
                            return (
                              <PropertyCard
                                key={`${src.id}-${idPart}`}
                                title={title}
                                properties={props}
                                variant="official"
                                germanKeyContext={{ data }}
                                datasetSnapshotValueMatches={datasetSnapshotValueMatches}
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
            <div className="bg-violet-950/8 px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
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

                {osm.status === 'done' && osmHits.length === 0 && (
                  <p className="text-sm text-slate-400">{de.feature.liveOsmEmpty}</p>
                )}

                {osm.status === 'done' && osmHits.length > 0 && (
                  <div className="space-y-3">
                    {osmHits.map((hit) => (
                      <PropertyCard
                        key={`${hit.type}-${hit.id}`}
                        title={de.feature.liveOsmHitTitle(hit.type, hit.id)}
                        osmBrowseLink={{ type: hit.type, id: hit.id }}
                        properties={withoutNameStarTags(hit.tags) as Record<string, unknown>}
                        variant="osm"
                        germanKeyContext={{ data }}
                        datasetSnapshotValueMatches={datasetSnapshotValueMatches}
                      />
                    ))}
                  </div>
                )}

                {osm.status === 'done' && (
                  <button
                    type="button"
                    onClick={() => {
                      overpass.reset()
                      setOsm({ status: 'idle' })
                    }}
                    className="text-sm text-violet-300/90 underline decoration-violet-400/30 underline-offset-2 hover:text-violet-200"
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
