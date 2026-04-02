import { officialForEditGeojsonHref } from '../data/paths'
import { de } from '../i18n/de'
import {
  absoluteUrlFromPath,
  buildJosmEditorLinks,
  buildOpenStreetMapIdEditUrl,
} from '../lib/osmEditorLinks'
import type { ReportRow } from '../types/report'

const editorBtnClass =
  'inline-flex w-full justify-center rounded-md border border-sky-800/50 bg-slate-950 px-3 py-2 text-sm text-sky-100 shadow-sm hover:bg-sky-950/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50'

function openInNewWindow(href: string) {
  window.open(href, '_blank', 'noopener,noreferrer')
}

function triggerGeojsonDownload(href: string) {
  const a = document.createElement('a')
  a.href = href
  const tail = href.split('/').pop()
  if (tail?.endsWith('.geojson')) a.download = tail
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function UpdateMapInstructions({
  areaId,
  row,
  snapshot,
}: {
  areaId: string
  row: ReportRow
  snapshot: string | null
}) {
  const u = de.feature.updateMap
  const officialHref = officialForEditGeojsonHref(areaId, row)
  const officialAbsolute = officialHref != null ? absoluteUrlFromPath(officialHref) : null
  const idUrl = buildOpenStreetMapIdEditUrl(row, officialAbsolute)
  const josm = buildJosmEditorLinks(row, officialAbsolute)
  const snapshotActive = snapshot != null && snapshot !== ''
  const canDownloadOfficial = officialHref != null

  return (
    <section className="mt-8 rounded border border-slate-700 bg-slate-900/50 p-4">
      <h2 className="font-semibold text-base tracking-tight text-slate-100">{u.title}</h2>
      <p className="mt-2 text-sm text-slate-400">{u.lead}</p>

      <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-10">
        <div>
          <h3 className="font-medium text-sm text-slate-200">{u.idHeading}</h3>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={!canDownloadOfficial}
              title={canDownloadOfficial ? undefined : u.downloadOfficialDisabledHint}
              className={editorBtnClass}
              onClick={() => officialHref != null && triggerGeojsonDownload(officialHref)}
            >
              {u.downloadOfficial}
            </button>
            {!canDownloadOfficial && (
              <p className="text-xs text-slate-500">{u.downloadOfficialDisabledHint}</p>
            )}
            {canDownloadOfficial && (
              <p className="text-xs text-slate-500">{u.downloadOfficialHint}</p>
            )}
            <button
              type="button"
              title={`${u.openId} — ${u.opensInNewWindowTitle}`}
              className={editorBtnClass}
              onClick={() => openInNewWindow(idUrl)}
            >
              {u.openId}
            </button>
            <p className="text-xs text-slate-500">
              {officialAbsolute ? u.openIdWithOverlay : u.openIdRelationOnly}
            </p>
          </div>
          <p className="mt-3 text-xs text-slate-500">{u.idDisableFeaturesHint}</p>
          <p className="mt-2 text-xs text-amber-300/90">{u.corsNote}</p>
        </div>

        <div>
          <h3 className="font-medium text-sm text-slate-200">{u.josmHeading}</h3>
          <p className="mt-3 text-sm text-slate-400">{u.josmRemoteLead}</p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={josm.loadObject == null}
              title={
                josm.loadObject != null
                  ? `${u.josmLoadObject} — ${u.opensInNewWindowTitle}`
                  : undefined
              }
              className={editorBtnClass}
              onClick={() => josm.loadObject != null && openInNewWindow(josm.loadObject)}
            >
              {u.josmLoadObject}
            </button>
            <button
              type="button"
              disabled={josm.importGeojson == null}
              title={
                josm.importGeojson != null
                  ? `${u.josmImport} — ${u.opensInNewWindowTitle}`
                  : undefined
              }
              className={editorBtnClass}
              onClick={() => josm.importGeojson != null && openInNewWindow(josm.importGeojson)}
            >
              {u.josmImport}
            </button>
            {josm.importGeojson == null && (
              <p className="text-xs text-slate-500">{u.josmImportDisabledHint}</p>
            )}
            <button
              type="button"
              disabled={josm.loadAndZoom == null}
              title={
                josm.loadAndZoom != null
                  ? `${u.josmLoadAndZoom} — ${u.opensInNewWindowTitle}`
                  : undefined
              }
              className={editorBtnClass}
              onClick={() => josm.loadAndZoom != null && openInNewWindow(josm.loadAndZoom)}
            >
              {u.josmLoadAndZoom}
            </button>
            {josm.loadAndZoom == null && row.osmRelationId.trim() !== '' && row.mapBbox == null && (
              <p className="text-xs text-slate-500">{u.josmLoadAndZoomDisabledHint}</p>
            )}
            {josm.loadObject == null && (
              <p className="text-xs text-slate-500">{u.josmNoRelation}</p>
            )}
          </div>
          {officialHref && <p className="mt-3 text-xs text-slate-500">{u.josmImportFallback}</p>}
          <p className="mt-2 text-xs text-slate-500">{u.josmMixedContent}</p>
        </div>
      </div>

      {snapshotActive && officialHref == null && (
        <p className="mt-6 border-slate-700 border-t pt-4 text-xs text-slate-500">
          {u.snapshotNoEditorFiles}
        </p>
      )}
      {!snapshotActive && row.officialForEditPath === undefined && (
        <p className="mt-6 border-slate-700 border-t pt-4 text-xs text-slate-500">
          {u.legacyTableHint}
        </p>
      )}
    </section>
  )
}
