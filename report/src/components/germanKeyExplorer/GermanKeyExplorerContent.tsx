import { useId, useState } from 'react'
import { de } from '../../i18n/de'
import {
  ags8FromArs12Digits,
  brandenburgGemeinden8From12,
  digitsOnly,
  lookupArsSegmentNames,
  lookupGemeindeNameByArs,
  lookupGemeindeNameByAgs,
  formatNormalizationNotesForExplorerUi,
  normalizationsForSchluesselExplorerTable,
  normalizationsForSchluesselPresets,
  parseArs12Segments,
  statistikportalGemeindeUrl,
  tryBerlinBezirkCanonical5,
  type Ars12Segments,
  type GermanKeyLookupTables,
  type GermanSchluesselExplorerPreset,
} from '../../lib/germanKeyExplorer'
import type { GermanKeySearch } from '../../lib/germanKeySearch'
import { ArsSegmentsTable } from './ArsSegmentsTable'

function presetLabel(p: GermanSchluesselExplorerPreset): string {
  return de.germanKeyExplorer.presets[p]
}

export function GermanKeyExplorerContent({
  lookupTables,
  search,
  onApplySearch,
}: {
  lookupTables: GermanKeyLookupTables
  search: GermanKeySearch
  onApplySearch: (next: GermanKeySearch) => void
}) {
  const t = de.germanKeyExplorer
  const formId = useId()
  const [localKey, setLocalKey] = useState(search.key ?? '')

  const raw = localKey.trim()
  const d = digitsOnly(raw)
  const padded12 =
    d.length > 0
      ? (normalizationsForSchluesselPresets(raw).find((r) => r.preset === 'regional-12')?.result
          .canonicalMatchKey ?? '')
      : ''
  const segments: Ars12Segments | null = padded12.length >= 12 ? parseArs12Segments(padded12) : null
  const segmentNames = padded12.length >= 12 ? lookupArsSegmentNames(lookupTables, padded12) : null
  const ags8From12 = d.length >= 12 ? ags8FromArs12Digits(d) : d.length >= 8 ? d.slice(0, 8) : null
  const bb8 = d.length >= 12 ? brandenburgGemeinden8From12(d) : null
  const agsForPortal =
    ags8From12 !== null && ags8From12.length === 8 ? ags8From12 : d.length === 8 ? d : null

  const bbName = bb8 ? lookupGemeindeNameByAgs(lookupTables, bb8) : null
  const berlin = tryBerlinBezirkCanonical5(raw)

  const rows = raw !== '' ? normalizationsForSchluesselExplorerTable(raw) : []
  const keyOverviewRows = [
    {
      value: padded12 || '—',
      osmKey: 'de:regionalschluessel',
      bkgKey: 'ARS',
      length: '12 Ziffern',
      name: padded12 ? lookupGemeindeNameByArs(lookupTables, padded12) : null,
    },
    {
      value: ags8From12 ?? '—',
      osmKey: 'de:amtlicher_gemeindeschluessel',
      bkgKey: 'AGS',
      length: '8 Ziffern',
      name: ags8From12 ? lookupGemeindeNameByAgs(lookupTables, ags8From12) : null,
    },
  ]

  function apply(ev: React.FormEvent) {
    ev.preventDefault()
    const next: GermanKeySearch = {}
    if (localKey.trim() !== '') next.key = localKey.trim()
    if (search.area) next.area = search.area
    if (search.preset) next.preset = search.preset
    if (search.gvDataset) next.gvDataset = search.gvDataset
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
            <h2 className="text-base font-semibold text-slate-100">{t.arsTableTitle}</h2>
            <ArsSegmentsTable segments={segments} names={segmentNames} />
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">{t.keyOverviewTitle}</h2>
            <p className="max-w-3xl text-sm text-slate-400">{t.keyOverviewLead}</p>
            <div className="overflow-hidden overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/40">
              <table className="w-full min-w-full text-sm">
                <thead className="border-b border-slate-700 bg-slate-900/80">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-300">
                      {t.keyOverviewColValue}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-300">
                      {t.keyOverviewColOsmKey}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-300">
                      {t.keyOverviewColBkgKey}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-300">
                      {t.keyOverviewColLength}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-slate-300">{t.colName}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/80">
                  {keyOverviewRows.map((row) => (
                    <tr key={row.bkgKey} className="text-slate-200 hover:bg-slate-800/50">
                      <td className="px-3 py-2 font-mono text-xs text-slate-100">{row.value}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-100">{row.osmKey}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-100">{row.bkgKey}</td>
                      <td className="px-3 py-2 text-slate-300">{row.length}</td>
                      <td className="px-3 py-2 text-slate-300">
                        {row.name ?? '—'}
                        {row.bkgKey === 'AGS' && row.name && bb8 && bbName ? (
                          <span className="text-slate-500"> · BB: {bbName}</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {berlin.ok ? (
              <p className="text-sm text-amber-200">
                {t.berlinExpanded}: <span className="font-mono">{berlin.value}</span>
              </p>
            ) : null}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-100">{t.normalizationTitle}</h2>
              <p className="mt-1 max-w-3xl text-sm text-slate-400">{t.normalizationLead}</p>
            </div>
            <div className="overflow-hidden overflow-x-auto rounded-lg border border-slate-700 bg-slate-900/40">
              <table className="w-full min-w-full text-sm">
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
                  {rows.map(({ preset, result }) => (
                    <tr key={preset} className="text-slate-200 hover:bg-slate-800/50">
                      <td className="px-3 py-2 font-medium">{presetLabel(preset)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-100">
                        {result.canonicalMatchKey || '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        {result.notes.length
                          ? formatNormalizationNotesForExplorerUi(result.notes)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">{t.linksTitle}</h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
              {agsForPortal ? (
                <li>
                  <span className="text-slate-400">{t.linksDetailPage}: </span>
                  <a
                    href={statistikportalGemeindeUrl(agsForPortal)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                  >
                    statistikportal.de/de/gemeindeverzeichnis/{agsForPortal}
                  </a>
                </li>
              ) : null}
              <li>
                <span className="text-slate-400">{t.linksWikiKeyPrefix}: </span>
                <a
                  href="https://wiki.openstreetmap.org/wiki/DE:Key:de:regionalschluessel"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                >
                  key:de:regionalschluessel
                </a>
              </li>
              <li>
                <span className="text-slate-400">{t.linksWikiKeyPrefix}: </span>
                <a
                  href="https://wiki.openstreetmap.org/wiki/DE:Key:de:amtlicher_gemeindeschluessel"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                >
                  key:de:amtlicher_gemeindeschluessel
                </a>
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
