import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { useLiveOsmObjects } from '../../hooks/useLiveOsmObjects'
import { de } from '../../i18n/de'
import { formatOverpassRunError } from '../../lib/formatOverpassRunError'
import {
  liveOsmCheckResults,
  liveOsmResultMarker,
  liveOsmTagMarkers,
} from '../../lib/liveOsmChecks'
import { overpassLiveRowKey } from '../../lib/liveRowKey'
import type { LiveOsmObjectRef } from '../../lib/overpassOsmObject'
import { useIsLiveRowHidden, useLiveOverlayActions } from '../../stores/liveOverlayVisibilityStore'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { sharedButtonClass } from '../sharedButtonStyles'
import { CompareMarker } from '../ui/CompareMarker'

/** What a live OSM object is compared against: the feature's row and the dataset's attribute checks. */
export type LiveOsmContext = {
  featureKey: string
  row: ReportRow
  data: ComparisonForReport
}

const TEXT_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 text-xs text-slate-300/90 underline decoration-slate-400/30 underline-offset-2 hover:text-slate-100'

/** `name:de`, `name:en`, … are noise in a tag listing. */
function listedTags(tags: Record<string, string>): Array<[string, string]> {
  return Object.entries(tags)
    .filter(([key]) => !key.startsWith('name:'))
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
}

/** Hides or shows one object's geometry on the detail map. */
function LiveRowMapToggle({ featureKey, type, id }: { featureKey: string } & LiveOsmObjectRef) {
  const rowKey = overpassLiveRowKey(type, id)
  const isHidden = useIsLiveRowHidden(featureKey, rowKey)
  const { show, hide } = useLiveOverlayActions()
  const label = isHidden ? de.feature.liveRowShowOnMap : de.feature.liveRowHideOnMap
  return (
    <button
      type="button"
      onClick={() => (isHidden ? show(featureKey, rowKey) : hide(featureKey, rowKey))}
      className={TEXT_BUTTON_CLASS}
    >
      {isHidden ? (
        <EyeSlashIcon aria-hidden="true" className="h-4 w-4" />
      ) : (
        <EyeIcon aria-hidden="true" className="h-4 w-4" />
      )}
      {label}
    </button>
  )
}

/** Tags of an OSM object; tags that an attribute check read carry its ✓/≠ marker. */
function LiveOsmTagList({
  tags,
  context,
}: {
  tags: Record<string, string>
  context: LiveOsmContext
}) {
  const { row, data } = context
  const results = liveOsmCheckResults(data.attributeChecks, row.officialProperties, tags)
  const markers = liveOsmTagMarkers(results, row.officialProperties)
  const entries = listedTags(tags)
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">{de.feature.liveOsmHitNoTags}</p>
  }
  return (
    <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="font-mono text-xs break-words text-slate-400">{key}</dt>
          <dd className="flex min-w-0 flex-wrap items-baseline gap-x-2 break-words text-slate-100">
            {value}
            {(markers.get(key) ?? []).map((marker) => (
              <CompareMarker key={marker.tooltip} equal={marker.equal} tooltip={marker.tooltip} />
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** One-line result of the attribute checks (marker and label) for a collapsed tag listing. */
function LiveOsmCheckBadges({
  tags,
  context,
}: {
  tags: Record<string, string>
  context: LiveOsmContext
}) {
  const { row, data } = context
  const results = liveOsmCheckResults(data.attributeChecks, row.officialProperties, tags)
  if (results.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {results.map((result) => {
        const marker = liveOsmResultMarker(result, row.officialProperties)
        return (
          <span
            key={result.label}
            className="inline-flex items-center gap-1 text-xs text-slate-300"
          >
            <CompareMarker equal={marker.equal} tooltip={marker.tooltip} />
            {result.label}
          </span>
        )
      })}
    </span>
  )
}

/**
 * Tags of an object found by the nearby search: they are live already, so the listing is collapsed
 * to its check results until opened. The geometry is on the map; the toggle hides it again.
 */
export function NearbyOsmObjectTags({
  type,
  id,
  tags,
  context,
}: {
  tags: Record<string, string>
  context: LiveOsmContext
} & LiveOsmObjectRef) {
  return (
    <div className="flex flex-col gap-2">
      <details className="group">
        <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-400 [&::-webkit-details-marker]:hidden">
          <span className="underline decoration-slate-600 underline-offset-2">
            {de.feature.liveOsmNearbyTags(listedTags(tags).length)}
          </span>
          <LiveOsmCheckBadges tags={tags} context={context} />
        </summary>
        <div className="mt-2">
          <LiveOsmTagList tags={tags} context={context} />
        </div>
      </details>
      <LiveRowMapToggle featureKey={context.featureKey} type={type} id={id} />
    </div>
  )
}

/** "Aktuellen Stand laden": fetches the object from Overpass; its geometry then shows on the map. */
export function LiveOsmObjectLoadButton({
  context,
  object,
  className = sharedButtonClass,
}: {
  context: LiveOsmContext
  object: LiveOsmObjectRef
  className?: string
}) {
  const { getState, load } = useLiveOsmObjects(context.featureKey)
  const status = getState(object)?.status
  return (
    <button
      type="button"
      disabled={status === 'loading'}
      onClick={() => void load(object)}
      className={className}
    >
      {status === 'loading'
        ? de.feature.liveOsmObjectLoading
        : status === 'done'
          ? de.feature.liveOsmObjectReload
          : de.feature.liveOsmObjectLoad}
    </button>
  )
}

/** Outcome of "Aktuellen Stand laden" for one object: error, deleted notice or the live tags. */
export function LiveOsmObjectResult({
  context,
  object,
}: {
  context: LiveOsmContext
  object: LiveOsmObjectRef
}) {
  const { getState } = useLiveOsmObjects(context.featureKey)
  const state = getState(object)
  if (!state || state.status === 'loading') return null

  if (state.status === 'error') {
    return (
      <div
        className="rounded-md border border-red-900/60 bg-red-950/35 px-3 py-2 text-sm text-red-100"
        role="alert"
      >
        <p className="font-medium">{de.feature.liveOsmLastErrorTitle}</p>
        <p className="mt-1 break-words whitespace-pre-wrap">
          {formatOverpassRunError(state.error)}
        </p>
      </div>
    )
  }

  if (state.tags === null) {
    return <p className="text-sm text-amber-300/90">{de.feature.liveOsmObjectGone}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
        {de.feature.liveOsmObjectTagsHeading}
      </p>
      <LiveOsmTagList tags={state.tags} context={context} />
      {state.features.length > 0 ? (
        <LiveRowMapToggle featureKey={context.featureKey} type={object.type} id={object.id} />
      ) : null}
    </div>
  )
}
