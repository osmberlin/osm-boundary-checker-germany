import {
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'
import { de } from '../i18n/de'
import { cn } from '../lib/cn'
import { formatOverpassRunError } from '../lib/formatOverpassRunError'
import {
  germanKeyExplorerLinkValueOrNull,
  isGermanKeyExplorerDisplayKey,
} from '../lib/germanKeyExplorer'
import {
  type LiveRowKey,
  addrPostcodeLiveRowKey,
  wfsFeatureIdPart,
  wfsLiveRowKey,
} from '../lib/liveRowKey'
import {
  addrPostcodeColorIndex,
  buildOverpassAddrPostcodeQuery,
  isPlzDatasetForReport,
  type AddrPostcodeHit,
} from '../lib/overpassAddrPostcode'
import { DEFAULT_OVERPASS_INTERPRETER_URL } from '../lib/overpassServers'
import type { WfsFeature } from '../lib/wfsGetFeature'
import {
  useHiddenLiveRowKeys,
  useIsLiveRowHidden,
  useLiveOverlayActions,
} from '../stores/liveOverlayVisibilityStore'
import type { ComparisonForReport, OgcWfsInspectSource, ReportRow } from '../types/report'
import { GermanKeyVerifyLink } from './GermanKeyVerifyLink'
import { mapLayerColors } from './mapLayerColors'
import { ProvenanceGridRow } from './ProvenanceGridRow'
import { ProvenanceGridSectionHeader } from './ProvenanceGridSectionHeader'
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
  addrPostcodeColorIndex: postcodeColorIndex,
  osmBrowseLink,
  germanKeyContext,
  datasetSnapshotValueMatches,
  disclosure,
}: {
  title: string
  properties: Record<string, unknown>
  variant: 'official' | 'addrPostcode'
  /** For `addrPostcode`: palette bucket from postcode label. */
  addrPostcodeColorIndex?: number
  /** When set (Overpass hit), an icon link to osm.org is rendered on the right of the summary row. */
  osmBrowseLink?: { type: string; id: number }
  germanKeyContext?: { data: ComparisonForReport }
  /** Serialized values from VG250/OSM snapshot cards; matching live rows use Overpass magenta. */
  datasetSnapshotValueMatches?: ReadonlySet<string>
  disclosure: PropertyCardDisclosure
}) {
  const entries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b, 'de'))
  const paletteEntry =
    variant === 'addrPostcode'
      ? mapLayerColors.addrPostcode.palette[
          Math.min(
            Math.max(0, postcodeColorIndex ?? 0),
            mapLayerColors.addrPostcode.palette.length - 1,
          )
        ]
      : null
  const color =
    variant === 'addrPostcode' && paletteEntry
      ? { line: paletteEntry.point, fillOpacity: 0.25 }
      : mapLayerColors.wfs
  const verifyLinkClass =
    'shrink-0 text-xs font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'
  const cardStyle = {
    borderColor: color.line,
    backgroundColor:
      variant === 'addrPostcode' && paletteEntry
        ? `${paletteEntry.point}33`
        : `rgb(76 29 149 / ${mapLayerColors.wfs.fillOpacity})`,
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
            {variant === 'addrPostcode' && paletteEntry ? (
              <span
                aria-hidden="true"
                className="h-3 w-3 shrink-0 rounded-full ring-1 ring-slate-900/80"
                style={{ backgroundColor: paletteEntry.point }}
              />
            ) : null}
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
                  <dt className="font-mono text-xs break-words text-slate-400">{k}</dt>
                  <dd className="min-w-0 break-words text-slate-100">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <span
                        className={cn(
                          'min-w-0 rounded-sm text-inherit',
                          /* Fuchsia highlight: the value also appears in the dataset snapshot cards. */
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

type AddrPostcodeLiveController = {
  hasCachedData: boolean
  hits: AddrPostcodeHit[]
  isRunPending: boolean
  runError: unknown
  runLiveOverpass: (query: string, interpreterUrl: string) => Promise<void>
  resetLiveOverpass: () => void
  resetRunMutation: () => void
}

type WfsLiveController = {
  load: (source: OgcWfsInspectSource, bbox: [number, number, number, number]) => Promise<void>
  getStatus: (sourceId: string) => OfficialSlot
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
    <ProvenanceGridRow
      asDl
      rightColumnClassName="mt-2 space-y-4"
      title={
        <>
          <h3 className="text-sm/6 font-medium text-slate-200">{de.feature.liveOfficialHeading}</h3>
          <LiveSectionVisibilityToggle featureKey={featureKey} rowKeys={wfsRowKeys} />
        </>
      }
    >
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
    </ProvenanceGridRow>
  )
}

function OverpassPlzAddrLiveRow({
  featureKey,
  data,
  getLiveQueryBbox,
  addrPostcode,
  datasetSnapshotValueMatches,
}: {
  featureKey: string
  data: ComparisonForReport
  getLiveQueryBbox: () => [number, number, number, number] | null
  addrPostcode: AddrPostcodeLiveController
  datasetSnapshotValueMatches: ReadonlySet<string>
}) {
  const addrHits = addrPostcode.hits
  const addrRowKeys = addrHits.map((hit) => addrPostcodeLiveRowKey(hit.type, hit.id))
  const viewportBbox = getLiveQueryBbox()

  async function loadAddrPostcodeLive() {
    const bbox = getLiveQueryBbox()
    if (!bbox) return
    addrPostcode.resetRunMutation()
    try {
      await addrPostcode.runLiveOverpass(
        buildOverpassAddrPostcodeQuery(bbox),
        DEFAULT_OVERPASS_INTERPRETER_URL,
      )
    } catch {
      /* Error surfaced via addrPostcode.runError */
    }
  }

  return (
    <ProvenanceGridRow
      asDl
      surfaceClassName="bg-violet-950/8"
      rightColumnClassName="mt-2 space-y-3"
      title={
        <>
          <h3 className="text-sm/6 font-medium text-slate-200">
            {de.feature.livePlzAddrRowHeading}
          </h3>
          <LiveSectionVisibilityToggle featureKey={featureKey} rowKeys={addrRowKeys} />
        </>
      }
    >
      <p className="text-sm text-slate-400">{de.feature.livePlzAddrPostcodeLead}</p>
      <p className="text-xs text-slate-500">{de.feature.livePlzAddrColorHint}</p>
      {!viewportBbox && (
        <p className="text-sm text-amber-300/90">{de.feature.liveMapViewportPending}</p>
      )}
      <button
        type="button"
        disabled={!viewportBbox || addrPostcode.isRunPending}
        onClick={() => void loadAddrPostcodeLive()}
        className={sharedButtonClass}
      >
        {de.feature.livePlzAddrPostcodeButton}
      </button>
      {addrPostcode.runError != null && !addrPostcode.isRunPending && (
        <div
          className="rounded-md border border-red-900/60 bg-red-950/35 px-3 py-2 text-sm text-red-100"
          role="alert"
        >
          <p className="font-medium">{de.feature.livePlzAddrLastErrorTitle}</p>
          <p className="mt-1 break-words whitespace-pre-wrap">
            {formatOverpassRunError(addrPostcode.runError)}
          </p>
          <p className="mt-2 text-xs text-red-200/85">{de.feature.livePlzAddrLastErrorHint}</p>
        </div>
      )}
      {addrPostcode.isRunPending && (
        <p className="text-sm text-slate-400">{de.feature.livePlzAddrLoading}</p>
      )}
      {addrPostcode.hasCachedData && addrHits.length > 0 && (
        <div className="space-y-3">
          {addrHits.map((hit) => {
            const postcode = hit.tags['addr:postcode'] ?? ''
            return (
              <LiveResultCard
                key={`addr-${hit.type}-${hit.id}`}
                featureKey={featureKey}
                rowKey={addrPostcodeLiveRowKey(hit.type, hit.id)}
                title={de.feature.livePlzAddrHitTitle(hit.type, hit.id, postcode || String(hit.id))}
                osmBrowseLink={{ type: hit.type, id: hit.id }}
                properties={withoutNameStarTags(hit.tags) as Record<string, unknown>}
                variant="addrPostcode"
                addrPostcodeColorIndex={addrPostcodeColorIndex(postcode)}
                germanKeyContext={{ data }}
                datasetSnapshotValueMatches={datasetSnapshotValueMatches}
              />
            )
          })}
        </div>
      )}
      {addrPostcode.hasCachedData && addrHits.length === 0 && !addrPostcode.isRunPending && (
        <p className="text-sm text-slate-400">{de.feature.livePlzAddrEmpty}</p>
      )}
      {addrPostcode.hasCachedData && (
        <button
          type="button"
          onClick={() => addrPostcode.resetLiveOverpass()}
          className="text-sm text-slate-300/90 underline decoration-slate-400/30 underline-offset-2 hover:text-slate-100"
        >
          {de.feature.livePlzAddrAgain}
        </button>
      )}
    </ProvenanceGridRow>
  )
}

export function LiveSourceProperties({
  featureKey,
  data,
  row,
  getLiveQueryBbox,
  wfs,
  addrPostcode,
}: {
  /** Stable id for this feature detail page; used as scope for live overlay visibility. */
  featureKey: string
  data: ComparisonForReport
  row: ReportRow
  getLiveQueryBbox: () => [number, number, number, number] | null
  wfs: WfsLiveController
  addrPostcode: AddrPostcodeLiveController
}) {
  const sources = data.ogcInspectSources ?? []
  const showOfficial = sources.length > 0
  const showPlzAddr = isPlzDatasetForReport(data)
  if (!showOfficial && !showPlzAddr) return null

  const datasetSnapshotValueMatches = buildDatasetSnapshotValueMatchSet(row)

  return (
    <details
      className="group overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={de.feature.liveSourcesSectionAria}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 hover:bg-white/5 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <ProvenanceGridSectionHeader
          title={de.feature.liveSourcesSectionTitle}
          className="min-w-0 flex-1"
        >
          <p className="mt-2 max-w-4xl text-sm text-slate-400">
            {de.feature.liveSourcesSectionLead}
          </p>
        </ProvenanceGridSectionHeader>
        <ChevronDownIcon
          aria-hidden="true"
          className="mt-6 mr-4 h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180 sm:mr-6"
        />
      </summary>

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

          {showPlzAddr && (
            <OverpassPlzAddrLiveRow
              featureKey={featureKey}
              data={data}
              getLiveQueryBbox={getLiveQueryBbox}
              addrPostcode={addrPostcode}
              datasetSnapshotValueMatches={datasetSnapshotValueMatches}
            />
          )}
        </dl>
      </div>
    </details>
  )
}
