import { ArrowTopRightOnSquareIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import { de } from '../i18n/de'
import { cn } from '../lib/cn'
import {
  germanKeyExplorerLinkValueOrNull,
  isGermanKeyExplorerDisplayKey,
} from '../lib/germanKeyExplorer'
import {
  type LiveRowKey,
  overpassLiveRowKey,
  wfsFeatureIdPart,
  wfsLiveRowKey,
} from '../lib/liveRowKey'
import { buildOverpassBoundaryQuery, type OverpassBoundaryHit } from '../lib/overpassBbox'
import { DEFAULT_OVERPASS_INTERPRETER_URL, OVERPASS_INSTANCES } from '../lib/overpassServers'
import { withSiteBasePath } from '../lib/siteBasePath'
import type { WfsFeature } from '../lib/wfsGetFeature'
import {
  useHiddenLiveRowKeys,
  useIsLiveRowHidden,
  useLiveOverlayActions,
} from '../stores/liveOverlayVisibilityStore'
import type {
  ComparisonForReport,
  OgcWfsInspectSource,
  OverpassBoundaryTag,
  ReportRow,
} from '../types/report'
import { GermanKeyVerifyLink } from './GermanKeyVerifyLink'
import { mapLayerColors } from './mapLayerColors'
import { sharedButtonClass } from './sharedButtonStyles'

type OfficialSlot =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'done'; features: WfsFeature[] }

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

type PropertyCardDisclosure = {
  isHidden: boolean
  onOpenChange: (open: boolean) => void
}

function PropertyCard({
  title,
  properties,
  variant,
  osmBrowseLink,
  boundaryCheckerLink,
  germanKeyContext,
  datasetSnapshotValueMatches,
  disclosure,
}: {
  title: string
  properties: Record<string, unknown>
  variant: 'official' | 'osm'
  /** When set (Overpass hit), an icon link to osm.org is rendered on the right of the summary row. */
  osmBrowseLink?: { type: string; id: number }
  /** Optional deep link to this app's relation resolver route. */
  boundaryCheckerLink?: string
  germanKeyContext?: { data: ComparisonForReport }
  /** Serialized values from VG250/OSM snapshot cards; matching live rows use Overpass magenta. */
  datasetSnapshotValueMatches?: ReadonlySet<string>
  disclosure: PropertyCardDisclosure
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

  const isOpen = !disclosure.isHidden
  const toggleLabel = disclosure.isHidden
    ? de.feature.liveRowShowOnMap
    : de.feature.liveRowHideOnMap

  return (
    <details
      open={isOpen}
      onToggle={(event) => {
        const nextOpen = (event.currentTarget as HTMLDetailsElement).open
        if (nextOpen !== isOpen) disclosure.onOpenChange(nextOpen)
      }}
      className="group rounded-lg border shadow-sm"
      style={cardStyle}
    >
      {/* Wrap children in a div: <summary> doesn't accept display:flex reliably across browsers. */}
      <summary
        title={toggleLabel}
        className="cursor-pointer list-none rounded-lg p-3 hover:bg-white/5 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-label={toggleLabel}
              className="flex shrink-0 items-center justify-center text-slate-300 group-hover:text-slate-100"
            >
              {disclosure.isHidden ? (
                <EyeSlashIcon aria-hidden="true" className="h-4 w-4" />
              ) : (
                <EyeIcon aria-hidden="true" className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 text-sm/6 font-medium break-words text-slate-100">
              {title}
            </span>
          </span>
          {osmBrowseLink ? (
            <span className="inline-flex shrink-0 items-center gap-3 text-xs">
              <a
                href={`https://www.openstreetmap.org/${osmBrowseLink.type}/${osmBrowseLink.id}`}
                target="_blank"
                rel="noreferrer noopener"
                title={de.feature.updateMap.opensInNewWindowTitle}
                aria-label={de.feature.liveOsmHitOpenLinkAria(osmBrowseLink.type, osmBrowseLink.id)}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
              >
                {de.feature.liveOsmHitOpenLink}
                <ArrowTopRightOnSquareIcon aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
              {boundaryCheckerLink ? (
                <a
                  href={boundaryCheckerLink}
                  target="_blank"
                  rel="noreferrer noopener"
                  title={de.feature.updateMap.opensInNewWindowTitle}
                  aria-label={de.feature.liveOsmHitOpenBoundaryCheckerAria(
                    osmBrowseLink.type,
                    osmBrowseLink.id,
                  )}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                >
                  {de.feature.liveOsmHitOpenBoundaryChecker(osmBrowseLink.id)}
                  <ArrowTopRightOnSquareIcon aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </span>
          ) : null}
        </div>
      </summary>
      <div className="px-3 pb-3">
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
      </div>
    </details>
  )
}

/**
 * Wraps PropertyCard with live overlay visibility from the Zustand store.
 * Closing the disclosure removes the row from the map; reopening shows it again.
 */
function LiveResultCard({
  featureKey,
  rowKey,
  ...rest
}: {
  featureKey: string
  rowKey: LiveRowKey
} & Omit<Parameters<typeof PropertyCard>[0], 'disclosure'>) {
  const isHidden = useIsLiveRowHidden(featureKey, rowKey)
  const { show, hide } = useLiveOverlayActions()
  return (
    <PropertyCard
      {...rest}
      disclosure={{
        isHidden,
        onOpenChange: (open) => {
          if (open) show(featureKey, rowKey)
          else hide(featureKey, rowKey)
        },
      }}
    />
  )
}

/**
 * Smart "hide all / show all" toggle for a section's rows.
 * - When at least one row is currently visible: hides all rows in `rowKeys`.
 * - When all rows are already hidden: shows all rows again.
 */
function LiveSectionVisibilityToggle({
  featureKey,
  rowKeys,
}: {
  featureKey: string
  rowKeys: readonly LiveRowKey[]
}) {
  const hidden = useHiddenLiveRowKeys(featureKey)
  const { hideMany, showMany } = useLiveOverlayActions()
  if (rowKeys.length === 0) return null
  const allHidden = rowKeys.every((k) => hidden.has(k))
  return (
    <button
      type="button"
      onClick={() => {
        if (allHidden) showMany(featureKey, rowKeys)
        else hideMany(featureKey, rowKeys)
      }}
      aria-label={allHidden ? de.feature.liveSectionShowAllAria : de.feature.liveSectionHideAllAria}
      className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-300/90 underline decoration-slate-400/30 underline-offset-2 hover:text-slate-100"
    >
      {allHidden ? (
        <EyeIcon aria-hidden="true" className="h-4 w-4" />
      ) : (
        <EyeSlashIcon aria-hidden="true" className="h-4 w-4" />
      )}
      {allHidden ? de.feature.liveSectionShowAll : de.feature.liveSectionHideAll}
    </button>
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

function formatOverpassRunError(error: unknown): string {
  const rawMessage =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error)
  if (rawMessage === 'INVALID_OVERPASS_JSON') return de.feature.liveOsmInvalidJson
  if (rawMessage.startsWith('Overpass request failed:')) {
    return `${de.feature.liveOsmHttp} ${rawMessage.replace('Overpass request failed:', '').trim()}`
  }
  return rawMessage
}

type WfsLiveController = {
  load: (source: OgcWfsInspectSource, bbox: [number, number, number, number]) => Promise<void>
  getStatus: (sourceId: string) => OfficialSlot
}

type OverpassLiveController = {
  hasCachedData: boolean
  hits: OverpassBoundaryHit[]
  isRunPending: boolean
  runError: unknown
  runLiveOverpass: (query: string, interpreterUrl: string) => Promise<void>
  resetLiveOverpass: () => void
  resetRunMutation: () => void
}

function OfficialLiveSourcesSection({
  featureKey,
  data,
  sources,
  getLiveQueryBbox,
  wfs,
  datasetSnapshotValueMatches,
}: {
  featureKey: string
  data: ComparisonForReport
  sources: readonly OgcWfsInspectSource[]
  getLiveQueryBbox: () => [number, number, number, number] | null
  wfs: WfsLiveController
  datasetSnapshotValueMatches: ReadonlySet<string>
}) {
  const wfsRowKeys: LiveRowKey[] = []
  for (const src of sources) {
    const slot = wfs.getStatus(src.id)
    if (slot.status !== 'done') continue
    slot.features.forEach((f, i) => {
      wfsRowKeys.push(wfsLiveRowKey(src.id, wfsFeatureIdPart(f, i)))
    })
  }

  async function loadOfficial(src: OgcWfsInspectSource) {
    const bbox = getLiveQueryBbox()
    if (!bbox) return
    await wfs.load(src, bbox)
  }

  const viewportBbox = getLiveQueryBbox()

  return (
    <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
      <dt>
        <h3 className="text-sm/6 font-medium text-slate-200">{de.feature.liveOfficialHeading}</h3>
        <LiveSectionVisibilityToggle featureKey={featureKey} rowKeys={wfsRowKeys} />
      </dt>
      <dd className="mt-2 space-y-4 md:col-span-2 md:mt-0">
        {!viewportBbox && (
          <p className="text-sm text-amber-300/90">{de.feature.liveMapViewportPending}</p>
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
                  disabled={!viewportBbox || slot.status === 'loading'}
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
                    const idPart = wfsFeatureIdPart(f, i)
                    const title =
                      f.id != null ? idPart : de.feature.liveOfficialFeatureTitle(i + 1, '')
                    return (
                      <LiveResultCard
                        key={`${src.id}-${idPart}`}
                        featureKey={featureKey}
                        rowKey={wfsLiveRowKey(src.id, idPart)}
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
  )
}

function OverpassLiveSourcesSection({
  featureKey,
  data,
  getLiveQueryBbox,
  overpassBoundaryTag,
  overpass,
  datasetSnapshotValueMatches,
}: {
  featureKey: string
  data: ComparisonForReport
  getLiveQueryBbox: () => [number, number, number, number] | null
  overpassBoundaryTag: OverpassBoundaryTag
  overpass: OverpassLiveController
  datasetSnapshotValueMatches: ReadonlySet<string>
}) {
  const [overpassDraft, setOverpassDraft] = useState<{
    query: string
    interpreterUrl: string
  } | null>(null)
  const osmHits = overpass.hits
  const datasetForResolver = data.area.trim()
  const overpassRowKeys = osmHits.map((hit) => overpassLiveRowKey(hit.type, hit.id))
  const viewportBbox = getLiveQueryBbox()

  function buildBoundaryCheckerResolverLink(relationId: number) {
    const query = new URLSearchParams()
    if (datasetForResolver !== '') query.set('dataset', datasetForResolver)
    const search = query.toString()
    const path = `/resolve/relation/${relationId}${search ? `?${search}` : ''}`
    return withSiteBasePath(path)
  }

  async function submitLiveOverpass() {
    if (!overpassDraft) return
    try {
      await overpass.runLiveOverpass(overpassDraft.query, overpassDraft.interpreterUrl)
      setOverpassDraft(null)
    } catch {
      /* Query error state is rendered in the confirm dialog. */
    }
  }

  return (
    <div className="bg-violet-950/8 px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
      <dt>
        <h3 className="text-sm/6 font-medium text-slate-200">{de.feature.liveOsmHeading}</h3>
        <LiveSectionVisibilityToggle featureKey={featureKey} rowKeys={overpassRowKeys} />
      </dt>
      <dd className="mt-2 space-y-3 md:col-span-2 md:mt-0">
        {!viewportBbox && (
          <p className="text-sm text-amber-300/90">{de.feature.liveMapViewportPending}</p>
        )}
        {!overpass.hasCachedData && overpassDraft == null && (
          <button
            type="button"
            disabled={!viewportBbox}
            onClick={() => {
              const bbox = getLiveQueryBbox()
              if (!bbox) return
              overpass.resetRunMutation()
              setOverpassDraft({
                query: buildOverpassBoundaryQuery(bbox, overpassBoundaryTag),
                interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
              })
            }}
            className={sharedButtonClass}
          >
            {de.feature.liveOsmLoad}
          </button>
        )}

        {overpassDraft != null && !overpass.isRunPending && (
          <div
            className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3"
            role="dialog"
            aria-labelledby="overpass-confirm-title"
          >
            <p id="overpass-confirm-title" className="text-sm font-medium text-amber-100">
              {de.feature.liveOsmOverpassWarnTitle}
            </p>
            <p className="mt-2 text-sm text-amber-200/90">{de.feature.liveOsmOverpassWarnLead}</p>
            <p className="mt-1 text-sm font-medium text-amber-100">
              {de.feature.liveOsmOverpassWarnScope}
            </p>
            {overpass.runError != null && (
              <div
                className="mt-3 rounded-md border border-red-900/60 bg-red-950/35 px-3 py-2 text-sm text-red-100"
                role="alert"
              >
                <p className="font-medium">{de.feature.liveOsmLastErrorTitle}</p>
                <p className="mt-1 break-words whitespace-pre-wrap">
                  {formatOverpassRunError(overpass.runError)}
                </p>
                <p className="mt-2 text-xs text-red-200/85">{de.feature.liveOsmLastErrorHint}</p>
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
              value={overpassDraft.interpreterUrl}
              onChange={(e) =>
                setOverpassDraft((d) => (d ? { ...d, interpreterUrl: e.target.value } : null))
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
              value={overpassDraft.query}
              onChange={(e) =>
                setOverpassDraft((d) => (d ? { ...d, query: e.target.value } : null))
              }
              spellCheck={false}
              rows={10}
              className="mt-1 max-h-64 min-h-[8rem] w-full resize-y rounded border border-slate-600 bg-slate-950 p-2 font-mono text-[11px] leading-snug text-slate-200 shadow-inner focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                const bbox = getLiveQueryBbox()
                if (!bbox) return
                setOverpassDraft((d) =>
                  d
                    ? {
                        ...d,
                        query: buildOverpassBoundaryQuery(bbox, overpassBoundaryTag),
                      }
                    : null,
                )
              }}
              className="mt-2 text-xs text-amber-200/85 underline decoration-amber-400/35 underline-offset-2 hover:text-amber-100"
            >
              {de.feature.liveOsmQueryReset}
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setOverpassDraft(null)
                  overpass.resetRunMutation()
                }}
                className={sharedButtonClass}
              >
                {de.feature.liveOsmConfirmNo}
              </button>
              <button
                type="button"
                disabled={overpassDraft.query.trim() === ''}
                onClick={() => void submitLiveOverpass()}
                className={sharedButtonClass}
              >
                {de.feature.liveOsmConfirmYes}
              </button>
            </div>
          </div>
        )}

        {overpass.isRunPending && (
          <p className="text-sm text-slate-400">{de.feature.liveOsmLoading}</p>
        )}

        {overpass.hasCachedData && osmHits.length === 0 && (
          <p className="text-sm text-slate-400">{de.feature.liveOsmEmpty}</p>
        )}

        {overpass.hasCachedData && osmHits.length > 0 && (
          <div className="space-y-3">
            {osmHits.map((hit) => (
              <LiveResultCard
                key={`${hit.type}-${hit.id}`}
                featureKey={featureKey}
                rowKey={overpassLiveRowKey(hit.type, hit.id)}
                title={de.feature.liveOsmHitTitle(hit.type, hit.id)}
                osmBrowseLink={{ type: hit.type, id: hit.id }}
                boundaryCheckerLink={buildBoundaryCheckerResolverLink(hit.id)}
                properties={withoutNameStarTags(hit.tags) as Record<string, unknown>}
                variant="osm"
                germanKeyContext={{ data }}
                datasetSnapshotValueMatches={datasetSnapshotValueMatches}
              />
            ))}
          </div>
        )}

        {overpass.hasCachedData && (
          <button
            type="button"
            onClick={() => {
              overpass.resetLiveOverpass()
              setOverpassDraft(null)
            }}
            className="text-sm text-violet-300/90 underline decoration-violet-400/30 underline-offset-2 hover:text-violet-200"
          >
            {de.feature.liveOsmAgain}
          </button>
        )}
      </dd>
    </div>
  )
}

export function LiveSourceProperties({
  featureKey,
  data,
  row,
  getLiveQueryBbox,
  wfs,
  overpass,
}: {
  /** Stable id for this feature detail page; used as scope for live overlay visibility. */
  featureKey: string
  data: ComparisonForReport
  row: ReportRow
  getLiveQueryBbox: () => [number, number, number, number] | null
  wfs: WfsLiveController
  overpass: OverpassLiveController
}) {
  const sources = data.ogcInspectSources ?? []
  const overpassBoundaryTag = data.overpassBoundaryTag ?? 'administrative'

  const datasetSnapshotValueMatches = buildDatasetSnapshotValueMatchSet(row)

  const showOfficial = sources.length > 0
  const showOsm = true
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
            <OfficialLiveSourcesSection
              featureKey={featureKey}
              data={data}
              sources={sources}
              getLiveQueryBbox={getLiveQueryBbox}
              wfs={wfs}
              datasetSnapshotValueMatches={datasetSnapshotValueMatches}
            />
          )}

          {showOsm && (
            <OverpassLiveSourcesSection
              featureKey={featureKey}
              data={data}
              getLiveQueryBbox={getLiveQueryBbox}
              overpassBoundaryTag={overpassBoundaryTag}
              overpass={overpass}
              datasetSnapshotValueMatches={datasetSnapshotValueMatches}
            />
          )}
        </dl>
      </div>
    </section>
  )
}
