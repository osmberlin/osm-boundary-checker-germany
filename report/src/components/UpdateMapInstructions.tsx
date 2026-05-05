import { useState } from 'react'
import type { ReactNode } from 'react'
import { officialForEditGeojsonHref } from '../data/paths'
import { de } from '../i18n/de'
import {
  absoluteUrlFromPath,
  buildJosmEditorLinks,
  buildOpenStreetMapIdEditUrl,
} from '../lib/osmEditorLinks'
import type { ReportRow } from '../types/report'
import { sharedButtonClass } from './sharedButtonStyles'

/** Stem + dot from Heroicons outline InformationCircleIcon (`circle` path removed; dot anchored at `M12 8.25…`). */
function InfoGlyphOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M12 8.25h.008v.008H12V8.25Z"
      />
    </svg>
  )
}

function RevealInfoNote({
  text,
  ariaLabel,
  children,
}: {
  text: string
  ariaLabel: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {!open ? (
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-600 text-slate-200 hover:border-slate-500 hover:text-slate-100"
            aria-label={ariaLabel}
            title={ariaLabel}
            onClick={() => setOpen(true)}
          >
            <InfoGlyphOutlineIcon className="size-6 shrink-0" />
          </button>
        ) : null}
      </div>
      {open ? <p className="text-xs text-pretty text-slate-500">{text}</p> : null}
    </div>
  )
}

export function UpdateMapInstructions({ areaId, row }: { areaId: string; row: ReportRow }) {
  const u = de.feature.updateMap
  const officialHref = officialForEditGeojsonHref(areaId, row)
  const officialBasename = officialHref?.split('/').pop()
  const officialDownloadFilename = officialBasename?.endsWith('.geojson')
    ? officialBasename
    : undefined
  const officialAbsolute = officialHref != null ? absoluteUrlFromPath(officialHref) : null
  const idUrl = buildOpenStreetMapIdEditUrl(row, officialAbsolute)
  const josm = buildJosmEditorLinks(row, officialAbsolute)
  const canDownloadOfficial = officialHref != null

  return (
    <section className="mt-10 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm">
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">{u.title}</h2>
      </div>

      <div className="border-t border-slate-700">
        <dl className="divide-y divide-slate-700/80">
          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{u.downloadOfficialHeading}</h3>
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <div className="flex flex-col gap-2">
                {canDownloadOfficial && officialHref != null ? (
                  <RevealInfoNote
                    text={u.downloadOfficialPipelineHint}
                    ariaLabel={u.revealHintAriaLabel}
                  >
                    <a
                      href={officialHref}
                      download={officialDownloadFilename}
                      className={sharedButtonClass}
                    >
                      {u.downloadOfficial}
                    </a>
                  </RevealInfoNote>
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
                <RevealInfoNote text={u.idDisableFeaturesHint} ariaLabel={u.revealHintAriaLabel}>
                  <a
                    href={idUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${u.openId} — ${u.opensInNewWindowTitle}`}
                    className={sharedButtonClass}
                  >
                    {u.openId}
                  </a>
                </RevealInfoNote>
              </div>
            </dd>
          </div>

          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{u.josmHeading}</h3>
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <div className="flex flex-col gap-2">
                {josm.importGeojson != null ? (
                  <a
                    href={josm.importGeojson}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${u.josmImportTitle} — ${u.opensInNewWindowTitle}`}
                    className={sharedButtonClass}
                  >
                    {u.josmImport}
                  </a>
                ) : (
                  <button type="button" disabled className={sharedButtonClass}>
                    {u.josmImport}
                  </button>
                )}
                {josm.loadObject != null ? (
                  <a
                    href={josm.loadObject}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${u.josmLoadObjectTitle} — ${u.opensInNewWindowTitle}`}
                    className={sharedButtonClass}
                  >
                    {u.josmLoadObject}
                  </a>
                ) : (
                  <button type="button" disabled className={sharedButtonClass}>
                    {u.josmLoadObject}
                  </button>
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
