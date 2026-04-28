import { officialForEditGeojsonHref } from '../data/paths'
import { de } from '../i18n/de'
import {
  absoluteUrlFromPath,
  buildJosmEditorLinks,
  buildOpenStreetMapIdEditUrl,
} from '../lib/osmEditorLinks'
import type { ReportRow } from '../types/report'
import { sharedButtonClass } from './sharedButtonStyles'

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

export function UpdateMapInstructions({ areaId, row }: { areaId: string; row: ReportRow }) {
  const u = de.feature.updateMap
  const officialHref = officialForEditGeojsonHref(areaId, row)
  const officialAbsolute = officialHref != null ? absoluteUrlFromPath(officialHref) : null
  const idUrl = buildOpenStreetMapIdEditUrl(row, officialAbsolute)
  const josm = buildJosmEditorLinks(row, officialAbsolute)
  const canDownloadOfficial = officialHref != null

  return (
    <section className="mt-12 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm">
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">{u.title}</h2>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">{u.lead}</p>
      </div>

      <div className="border-t border-slate-700">
        <dl className="divide-y divide-slate-700/80">
          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{u.downloadOfficialHeading}</h3>
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <div className="flex flex-col gap-2">
                {canDownloadOfficial ? (
                  <>
                    <button
                      type="button"
                      className={sharedButtonClass}
                      onClick={() => officialHref != null && triggerGeojsonDownload(officialHref)}
                    >
                      {u.downloadOfficial}
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled
                      title={u.downloadOfficialDisabledHint}
                      className={sharedButtonClass}
                    >
                      {u.downloadOfficial}
                    </button>
                    <p className="text-xs text-slate-500">{u.downloadOfficialDisabledHint}</p>
                  </div>
                )}
              </div>
            </dd>
          </div>

          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{u.idHeading}</h3>
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <div className="flex flex-col gap-2">
                <a
                  href={idUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${u.openId} — ${u.opensInNewWindowTitle}`}
                  className={sharedButtonClass}
                >
                  {u.openId}
                </a>
              </div>
              <p className="mt-3 text-xs text-slate-500">{u.idDisableFeaturesHint}</p>
            </dd>
          </div>

          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{u.josmHeading}</h3>
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <div className="flex flex-col gap-2">
                {josm.loadObject != null ? (
                  <a
                    href={josm.loadObject}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${u.josmLoadObject} — ${u.opensInNewWindowTitle}`}
                    className={sharedButtonClass}
                  >
                    {u.josmLoadObject}
                  </a>
                ) : (
                  <button type="button" disabled className={sharedButtonClass}>
                    {u.josmLoadObject}
                  </button>
                )}
                {josm.importGeojson != null ? (
                  <a
                    href={josm.importGeojson}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${u.josmImport} — ${u.opensInNewWindowTitle}`}
                    className={sharedButtonClass}
                  >
                    {u.josmImport}
                  </a>
                ) : (
                  <button type="button" disabled className={sharedButtonClass}>
                    {u.josmImport}
                  </button>
                )}
                {josm.loadAndZoom != null ? (
                  <a
                    href={josm.loadAndZoom}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${u.josmLoadAndZoom} — ${u.opensInNewWindowTitle}`}
                    className={sharedButtonClass}
                  >
                    {u.josmLoadAndZoom}
                  </a>
                ) : (
                  <button type="button" disabled className={sharedButtonClass}>
                    {u.josmLoadAndZoom}
                  </button>
                )}
                {josm.loadAndZoom == null &&
                  row.osmRelationId.trim() !== '' &&
                  row.mapBbox == null && (
                    <p className="text-xs text-slate-500">{u.josmLoadAndZoomDisabledHint}</p>
                  )}
                {josm.loadObject == null && (
                  <p className="text-xs text-slate-500">{u.josmNoRelation}</p>
                )}
              </div>
            </dd>
          </div>
        </dl>
      </div>

      {row.officialForEditPath === undefined && (
        <p className="border-t border-slate-700 px-4 py-4 text-xs text-slate-500 sm:px-6">
          {u.tableHint}
        </p>
      )}
    </section>
  )
}
