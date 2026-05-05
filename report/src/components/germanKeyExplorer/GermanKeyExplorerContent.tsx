import { useId, useState } from 'react'
import type { IdNormalizationPreset } from '../../../../scripts/shared/comparisonPayload.ts'
import { de } from '../../i18n/de'
import {
  ags8FromArs12Digits,
  ALL_ID_NORMALIZATION_PRESETS,
  brandenburgGemeinden8From12,
  digitsOnly,
  normalizationsForAllPresets,
  parseArs12Segments,
  statistikportalGemeindeUrl,
  tryBerlinBezirkCanonical5,
  type Ars12Segments,
} from '../../lib/germanKeyExplorer'
import type { GermanKeySearch } from '../../lib/germanKeySearch'
import { ArsSegmentsTable } from './ArsSegmentsTable'

function presetLabel(p: IdNormalizationPreset): string {
  return de.germanKeyExplorer.presets[p]
}

export function GermanKeyExplorerContent({
  search,
  onApplySearch,
}: {
  search: GermanKeySearch
  onApplySearch: (next: GermanKeySearch) => void
}) {
  const t = de.germanKeyExplorer
  const formId = useId()
  const urlKey = search.key ?? ''
  const urlPreset: IdNormalizationPreset | '' = search.preset ?? ''
  const [localKey, setLocalKey] = useState(urlKey)
  const [highlightPreset, setHighlightPreset] = useState<IdNormalizationPreset | ''>(urlPreset)
  const urlEpoch = `${urlKey}\0${urlPreset}`
  const [syncedEpoch, setSyncedEpoch] = useState(urlEpoch)
  if (urlEpoch !== syncedEpoch) {
    setSyncedEpoch(urlEpoch)
    setLocalKey(urlKey)
    setHighlightPreset(urlPreset)
  }

  const raw = localKey.trim()
  const d = digitsOnly(raw)
  const padded12 =
    d.length > 0
      ? (normalizationsForAllPresets(raw).find((r) => r.preset === 'regional-12')?.result
          .canonicalMatchKey ?? '')
      : ''
  const segments: Ars12Segments | null = padded12.length >= 12 ? parseArs12Segments(padded12) : null
  const ags8From12 = d.length >= 12 ? ags8FromArs12Digits(d) : d.length >= 8 ? d.slice(0, 8) : null
  const bb8 = d.length >= 12 ? brandenburgGemeinden8From12(d) : null
  const agsForPortal =
    ags8From12 !== null && ags8From12.length === 8 ? ags8From12 : d.length === 8 ? d : null
  const berlin = tryBerlinBezirkCanonical5(raw)

  const rows = raw !== '' ? normalizationsForAllPresets(raw) : []
  const effectiveHighlight = highlightPreset === '' ? undefined : highlightPreset

  function apply(ev: React.FormEvent) {
    ev.preventDefault()
    const next: GermanKeySearch = {}
    if (localKey.trim() !== '') next.key = localKey.trim()
    if (search.area) next.area = search.area
    if (highlightPreset !== '') next.preset = highlightPreset
    onApplySearch(next)
  }

  return (
    <div className="space-y-10">
      <form id={formId} className="space-y-4" onSubmit={apply}>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[min(100%,20rem)] flex-1">
            <label className="block text-sm font-medium text-slate-200" htmlFor={`${formId}-key`}>
              {t.inputLabel}
            </label>
            <input
              id={`${formId}-key`}
              type="text"
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
              placeholder={t.inputPlaceholder}
              value={localKey}
              onChange={(e) => setLocalKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium text-slate-200"
              htmlFor={`${formId}-preset`}
            >
              {t.presetLabel}
            </label>
            <select
              id={`${formId}-preset`}
              className="mt-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
              value={highlightPreset}
              onChange={(e) =>
                setHighlightPreset((e.target.value || '') as IdNormalizationPreset | '')
              }
            >
              <option value="">{t.presetOptionAll}</option>
              {ALL_ID_NORMALIZATION_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {presetLabel(p)}
                </option>
              ))}
            </select>
            <p className="mt-1 max-w-md text-xs text-slate-500">{t.presetHint}</p>
          </div>
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            {t.submitUrl}
          </button>
        </div>
      </form>

      {search.area ? (
        <p className="rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-400">
          {t.areaBadge(search.area)}
        </p>
      ) : null}

      {raw === '' ? (
        <p className="text-sm text-slate-500">{t.emptyState}</p>
      ) : (
        <>
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">{t.arsTableTitle}</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">{t.arsTableLead}</p>
              <p className="mt-2 font-mono text-xs text-slate-500">
                {t.digitsLabel}: {d || '—'}
                {padded12 ? (
                  <>
                    {' '}
                    → regional-12: <span className="text-slate-300">{padded12}</span>
                  </>
                ) : null}
              </p>
            </div>
            <ArsSegmentsTable segments={segments} />
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">{t.agsTitle}</h2>
            <p className="max-w-3xl text-sm text-slate-400">{t.agsLead}</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
              <li>
                {t.agsFromArs}:{' '}
                <span className="font-mono text-slate-100">{ags8From12 ?? '—'}</span>
              </li>
              {bb8 ? (
                <li>
                  {t.derivedBb}: <span className="font-mono text-slate-100">{bb8}</span>
                </li>
              ) : null}
            </ul>
          </section>

          {berlin.ok ? (
            <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <h2 className="text-base font-semibold text-amber-100">{t.berlinTitle}</h2>
              <p className="mt-1 text-sm text-amber-100/90">{t.berlinLead}</p>
              <p className="mt-2 font-mono text-sm text-amber-50">
                {t.berlinExpanded}: {berlin.value}
              </p>
            </section>
          ) : null}

          {agsForPortal ? (
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-slate-100">{t.statistikportalTitle}</h2>
              <p className="max-w-3xl text-sm text-slate-400">{t.statistikportalLead}</p>
              <a
                href={statistikportalGemeindeUrl(agsForPortal)}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-600"
              >
                {t.statistikportalButton}
              </a>
            </section>
          ) : null}

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">{t.wikiLinksTitle}</h2>
            <ul className="flex flex-wrap gap-4 text-sm">
              <li>
                <a
                  href="https://wiki.openstreetmap.org/wiki/DE:Key:de:regionalschluessel"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                >
                  {t.wikiRsLabel}
                </a>
              </li>
              <li>
                <a
                  href="https://wiki.openstreetmap.org/wiki/DE:Key:de:amtlicher_gemeindeschluessel"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                >
                  {t.wikiAgsLabel}
                </a>
              </li>
              <li>
                <a
                  href="https://www.statistikportal.de/de/gemeindeverzeichnis"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                >
                  {t.statistikportalHomePage}
                </a>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">{t.normalizationTitle}</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">{t.normalizationLead}</p>
              <p className="mt-1 text-xs text-slate-500">
                {t.sourceKeyRs}:{' '}
                <span className="font-mono text-slate-400">{t.sourceKeyRsValue}</span> /{' '}
                <span className="font-mono text-slate-400">postal_code</span> /{' '}
                <span className="font-mono text-slate-400">name</span> (je nach Preset)
              </p>
            </div>
            <div className="overflow-hidden overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/40">
              <table className="min-w-[40rem] text-sm">
                <thead className="border-b border-slate-700 bg-slate-900/80">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-300">
                      {t.colPreset}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-300">
                      {t.colCanonical}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-300">{t.colNotes}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/80">
                  {rows.map(({ preset, result }) => {
                    const active = effectiveHighlight !== undefined && preset === effectiveHighlight
                    return (
                      <tr
                        key={preset}
                        className={
                          active
                            ? 'bg-sky-950/40 text-slate-100'
                            : 'text-slate-200 hover:bg-slate-800/50'
                        }
                      >
                        <td className="px-3 py-2 font-medium">{presetLabel(preset)}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-100">
                          {result.canonicalMatchKey || '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-400">
                          {result.notes.length ? result.notes.join('; ') : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-700 bg-slate-900/30 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-200">{t.govconnectTitle}</h2>
            <p className="mt-2 text-sm text-slate-400">{t.govconnectBody}</p>
          </section>
        </>
      )}
    </div>
  )
}
