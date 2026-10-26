import { useId, useState } from 'react'
import type { useFeatureDetailOverpass } from '../../hooks/useFeatureDetailOverpass'
import { de } from '../../i18n/de'
import { formatOverpassRunError } from '../../lib/formatOverpassRunError'
import { buildOverpassBoundaryQuery } from '../../lib/overpassBbox'
import { DEFAULT_OVERPASS_INTERPRETER_URL, OVERPASS_INSTANCES } from '../../lib/overpassServers'
import type { OverpassBoundaryTag } from '../../types/report'
import { sharedButtonClass } from '../sharedButtonStyles'

/** Bbox search of OSM boundaries around the map viewport; its results come from `useFeatureDetailOverpass`. */
export type NearbyOsmSearchState = ReturnType<typeof useFeatureDetailOverpass>

type Bbox = [number, number, number, number]

/**
 * "Weitere OSM-Objekte in der Umgebung suchen": runs the boundary query for the current map
 * viewport after the usual Overpass warning (server and query editable). The found objects are
 * rendered by the caller as candidate entries; this only handles the request and its status.
 */
export function NearbyOsmSearch({
  search,
  getLiveQueryBbox,
  overpassBoundaryTag,
  entryCount,
}: {
  search: NearbyOsmSearchState
  getLiveQueryBbox: () => Bbox | null
  overpassBoundaryTag: OverpassBoundaryTag
  /** Number of entries the caller shows from the results (after dropping known candidates). */
  entryCount: number
}) {
  const id = useId()
  const [draft, setDraft] = useState<{ query: string; interpreterUrl: string } | null>(null)
  const viewportBbox = getLiveQueryBbox()

  async function submit() {
    if (!draft) return
    try {
      await search.runLiveOverpass(draft.query, draft.interpreterUrl)
      setDraft(null)
    } catch {
      /* The error is shown inside the dialog. */
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {!viewportBbox && (
        <p className="text-sm text-amber-300/90">{de.feature.liveMapViewportPending}</p>
      )}
      {!search.hasCachedData && draft == null && (
        <button
          type="button"
          disabled={!viewportBbox || search.isRunPending}
          onClick={() => {
            const bbox = getLiveQueryBbox()
            if (!bbox) return
            search.resetRunMutation()
            setDraft({
              query: buildOverpassBoundaryQuery(bbox, overpassBoundaryTag),
              interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
            })
          }}
          className={sharedButtonClass}
        >
          {de.feature.liveOsmNearbySearch}
        </button>
      )}

      {draft != null && !search.isRunPending && (
        <div
          className="w-full rounded-lg border border-amber-900/50 bg-amber-950/20 p-3"
          role="dialog"
          aria-labelledby={`${id}-title`}
        >
          <p id={`${id}-title`} className="text-sm font-medium text-amber-100">
            {de.feature.liveOsmOverpassWarnTitle}
          </p>
          <p className="mt-2 text-sm text-amber-200/90">{de.feature.liveOsmOverpassWarnLead}</p>
          <p className="mt-1 text-sm font-medium text-amber-100">
            {de.feature.liveOsmOverpassWarnScope}
          </p>
          {search.runError != null && (
            <div
              className="mt-3 rounded-md border border-red-900/60 bg-red-950/35 px-3 py-2 text-sm text-red-100"
              role="alert"
            >
              <p className="font-medium">{de.feature.liveOsmLastErrorTitle}</p>
              <p className="mt-1 break-words whitespace-pre-wrap">
                {formatOverpassRunError(search.runError)}
              </p>
              <p className="mt-2 text-xs text-red-200/85">{de.feature.liveOsmLastErrorHint}</p>
            </div>
          )}
          <label
            htmlFor={`${id}-server`}
            className="mt-3 block text-xs font-medium tracking-wide text-slate-400 uppercase"
          >
            {de.feature.liveOsmServerLabel}
          </label>
          <select
            id={`${id}-server`}
            value={draft.interpreterUrl}
            onChange={(e) => setDraft((d) => (d ? { ...d, interpreterUrl: e.target.value } : null))}
            className="mt-1 block w-full max-w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-100 shadow-sm focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 focus:outline-none"
          >
            {OVERPASS_INSTANCES.map((inst) => (
              <option key={inst.interpreterUrl} value={inst.interpreterUrl}>
                {inst.interpreterUrl}
              </option>
            ))}
          </select>
          <label
            htmlFor={`${id}-query`}
            className="mt-3 block text-xs font-medium tracking-wide text-slate-400 uppercase"
          >
            {de.feature.liveOsmOverpassWarnQuery}
          </label>
          <textarea
            id={`${id}-query`}
            value={draft.query}
            onChange={(e) => setDraft((d) => (d ? { ...d, query: e.target.value } : null))}
            spellCheck={false}
            rows={10}
            className="mt-1 max-h-64 min-h-[8rem] w-full resize-y rounded border border-slate-600 bg-slate-950 p-2 font-mono text-[11px] leading-snug text-slate-200 shadow-inner focus:border-amber-600 focus:ring-1 focus:ring-amber-600/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              const bbox = getLiveQueryBbox()
              if (!bbox) return
              setDraft((d) =>
                d ? { ...d, query: buildOverpassBoundaryQuery(bbox, overpassBoundaryTag) } : null,
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
                setDraft(null)
                search.resetRunMutation()
              }}
              className={sharedButtonClass}
            >
              {de.feature.liveOsmConfirmNo}
            </button>
            <button
              type="button"
              disabled={draft.query.trim() === ''}
              onClick={() => void submit()}
              className={sharedButtonClass}
            >
              {de.feature.liveOsmConfirmYes}
            </button>
          </div>
        </div>
      )}

      {search.isRunPending && <p className="text-sm text-slate-400">{de.feature.liveOsmLoading}</p>}

      {search.hasCachedData && entryCount === 0 && (
        <p className="text-sm text-slate-400">{de.feature.liveOsmNearbyEmpty}</p>
      )}

      {search.hasCachedData && (
        <button
          type="button"
          onClick={() => {
            search.resetLiveOverpass()
            setDraft(null)
          }}
          className="text-sm text-violet-300/90 underline decoration-violet-400/30 underline-offset-2 hover:text-violet-200"
        >
          {de.feature.liveOsmNearbyAgain}
        </button>
      )}
    </div>
  )
}
