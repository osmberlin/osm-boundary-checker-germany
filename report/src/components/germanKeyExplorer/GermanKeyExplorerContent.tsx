import { useId, useState } from 'react'
import type { GermanKeyLookupBundle } from '../../../../scripts/shared/germanKeyLookupPayload.ts'
import { de } from '../../i18n/de'
import {
  ags8FromArs12Digits,
  brandenburgGemeinden8From12,
  digitsOnly,
  lookupNameForNormalizedPresetKey,
  formatNormalizationNotesForExplorerUi,
  normalizationsForSchluesselExplorerTable,
  normalizationsForSchluesselPresets,
  parseArs12Segments,
  statistikportalGemeindeUrl,
  tryBerlinBezirkCanonical5,
  type GermanSchluesselExplorerPreset,
} from '../../lib/germanKeyExplorer'
import {
  collectObsoleteFields,
  isGermanKeyDigitHeavyInput,
  lookupArsSegmentNameCells,
  mergeGermanKeyLookupTables,
  resolveGemeindeNameByAgs,
  resolveGemeindeNameByArs,
  searchGermanKeyDisplayNames,
  type GermanKeyNameSearchHit,
} from '../../lib/germanKeyLookupBundle'
import type { GermanKeySearch } from '../../lib/germanKeySearch'
import { AlertNotice } from '../AlertNotice'
import {
  AppDialogActions,
  AppDialogBody,
  AppDialogDescription,
  AppDialogTitle,
  Dialog,
} from '../ui/Dialog'
import { ArsSegmentsTable } from './ArsSegmentsTable'

function presetLabel(p: GermanSchluesselExplorerPreset): string {
  return de.germanKeyExplorer.presets[p]
}

export function GermanKeyExplorerContent({
  bundle,
  search,
  onApplySearch,
}: {
  bundle: GermanKeyLookupBundle
  search: GermanKeySearch
  onApplySearch: (next: GermanKeySearch) => void
}) {
  const t = de.germanKeyExplorer
  const formId = useId()
  const explorerKeyFieldName = 'explorerKey'
  const [nameSearchFeedback, setNameSearchFeedback] = useState<string | null>(null)
  const [pickHits, setPickHits] = useState<GermanKeyNameSearchHit[] | null>(null)

  const mergedTables = mergeGermanKeyLookupTables(bundle)

  /** URL is source of truth for tables and deep links; input commits via submit only. */
  const raw = (search.key ?? '').trim()
  const d = digitsOnly(raw)
  const padded12 =
    d.length > 0
      ? (normalizationsForSchluesselPresets(raw).find((r) => r.preset === 'regional-12')?.result
          .canonicalMatchKey ?? '')
      : ''
  const segments = padded12.length >= 12 ? parseArs12Segments(padded12) : null
  const segmentCells = padded12.length >= 12 ? lookupArsSegmentNameCells(bundle, padded12) : null
  const ags8From12 = d.length >= 12 ? ags8FromArs12Digits(d) : d.length >= 8 ? d.slice(0, 8) : null
  const bb8 = d.length >= 12 ? brandenburgGemeinden8From12(d) : null
  const agsForPortal =
    ags8From12 !== null && ags8From12.length === 8 ? ags8From12 : d.length === 8 ? d : null

  const bbResolved = bb8 ? resolveGemeindeNameByAgs(bundle, bb8) : null
  const berlin = tryBerlinBezirkCanonical5(raw)

  const rows = raw !== '' ? normalizationsForSchluesselExplorerTable(raw) : []

  const arsResolved =
    padded12.length >= 12
      ? resolveGemeindeNameByArs(bundle, padded12)
      : { value: null as string | null }
  const agsResolved =
    ags8From12 !== null && ags8From12.length === 8
      ? resolveGemeindeNameByAgs(bundle, ags8From12)
      : d.length === 8
        ? resolveGemeindeNameByAgs(bundle, d)
        : { value: null as string | null }

  const obsoleteMetaFields = [
    ...(segmentCells ? Object.values(segmentCells) : []),
    ...(arsResolved.value !== null ? [arsResolved] : []),
    ...(agsResolved.value !== null ? [agsResolved] : []),
  ]
  const obsoletePublications = collectObsoleteFields(obsoleteMetaFields)

  const keyOverviewRows = [
    {
      value: padded12 || '—',
      osmKey: 'de:regionalschluessel',
      bkgKey: 'ARS',
      length: '12 Ziffern',
      resolved: arsResolved,
    },
    {
      value: ags8From12 ?? '—',
      osmKey: 'de:amtlicher_gemeindeschluessel',
      bkgKey: 'AGS',
      length: '8 Ziffern',
      resolved: agsResolved,
    },
  ]

  function applyKeyToSearch(keyValue: string) {
    const next: GermanKeySearch = {}
    if (keyValue.trim() !== '') next.key = keyValue.trim()
    if (search.area) next.area = search.area
    if (search.preset) next.preset = search.preset
    onApplySearch(next)
  }

  function apply(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setNameSearchFeedback(null)
    const submitted = String(new FormData(ev.currentTarget).get(explorerKeyFieldName) ?? '').trim()
    if (submitted === '') {
      applyKeyToSearch('')
      return
    }

    if (isGermanKeyDigitHeavyInput(submitted)) {
      applyKeyToSearch(submitted)
      return
    }

    const hits = searchGermanKeyDisplayNames(bundle, submitted)
    if (hits.length === 0) {
      setNameSearchFeedback(t.nameSearchNoResults)
      return
    }
    if (hits.length === 1) {
      applyKeyToSearch(hits[0]!.id)
      return
    }
    setPickHits(hits)
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
              key={search.key ?? ''}
              name={explorerKeyFieldName}
              type="text"
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
              placeholder={t.inputPlaceholder}
              defaultValue={search.key ?? ''}
              onInput={() => {
                setNameSearchFeedback(null)
              }}
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

      {nameSearchFeedback ? <p className="text-sm text-slate-400">{nameSearchFeedback}</p> : null}

      {search.area ? (
        <p className="rounded-md border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-400">
          {t.areaBadge(search.area)}
        </p>
      ) : null}

      {raw === '' ? (
        <p className="text-sm text-slate-500">{t.emptyState}</p>
      ) : (
        <>
          {obsoletePublications.length > 0 ? (
            <AlertNotice>
              <p>{t.obsoleteNoticeLead}</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {obsoletePublications.map((pub) => (
                  <li key={`${pub.year}-${pub.sourcePublicUrl}`}>
                    <span>
                      {t.obsoleteNoticeYearBadge(pub.year)}{' '}
                      <a
                        href={pub.sourcePublicUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="font-medium text-amber-100 underline decoration-amber-600/60 underline-offset-2 hover:decoration-amber-300"
                      >
                        {t.obsoleteNoticePublicationLink}
                      </a>
                    </span>
                  </li>
                ))}
              </ul>
            </AlertNotice>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-slate-100">{t.arsTableTitle}</h2>
            <ArsSegmentsTable segments={segments} nameCells={segmentCells} />
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
                        {row.resolved.value !== null ? (
                          <span>
                            <span
                              className={row.resolved.obsolete ? 'text-amber-200/95' : undefined}
                            >
                              {row.resolved.value}
                            </span>
                            {row.resolved.obsolete ? (
                              <span className="ml-1 text-xs text-amber-400/90">
                                ({t.obsoleteYearSuffix(row.resolved.obsolete.year)})
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          '—'
                        )}
                        {row.bkgKey === 'AGS' && row.resolved.value && bb8 && bbResolved?.value ? (
                          <span className="text-slate-500">
                            {' '}
                            · BB:{' '}
                            <span className={bbResolved.obsolete ? 'text-amber-200/90' : undefined}>
                              {bbResolved.value}
                            </span>
                            {bbResolved.obsolete ? (
                              <span className="text-xs text-amber-400/85">
                                {' '}
                                ({t.obsoleteYearSuffix(bbResolved.obsolete.year)})
                              </span>
                            ) : null}
                          </span>
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
                    <th className="px-3 py-2 text-left font-medium text-slate-300">{t.colName}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/80">
                  {rows.map(({ preset, result }) => {
                    const nm =
                      result.canonicalMatchKey !== ''
                        ? lookupNameForNormalizedPresetKey(
                            mergedTables,
                            preset,
                            result.canonicalMatchKey,
                          )
                        : null
                    return (
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
                        <td className="px-3 py-2 text-xs text-slate-400">{nm ?? '—'}</td>
                      </tr>
                    )
                  })}
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

      <Dialog open={pickHits !== null} onClose={() => setPickHits(null)} size="md">
        <AppDialogTitle>{t.nameSearchPickTitle}</AppDialogTitle>
        <AppDialogDescription>{t.nameSearchPickLead}</AppDialogDescription>
        <AppDialogBody>
          <ul className="list-none space-y-3 p-0">
            {(pickHits ?? []).map((hit) => (
              <li
                key={`${hit.kind}-${hit.id}`}
                className="flex flex-col gap-2 rounded border border-slate-700/80 bg-slate-800/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-100">{hit.displayName}</div>
                  <div className="mt-0.5 font-mono text-xs text-slate-400">
                    {hit.kind === 'ags' ? 'AGS' : 'ARS'} {hit.id}
                    {hit.obsolete ? (
                      <span className="ml-2 text-amber-400/90">
                        ({t.obsoleteYearSuffix(hit.obsolete.year)})
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-sm font-medium text-sky-400 underline decoration-slate-500/60 underline-offset-2 hover:text-sky-300"
                  onClick={() => {
                    applyKeyToSearch(hit.id)
                    setPickHits(null)
                  }}
                >
                  {t.nameSearchPickApply}
                </button>
              </li>
            ))}
          </ul>
        </AppDialogBody>
        <AppDialogActions>
          <button
            type="button"
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 shadow-sm hover:bg-slate-700"
            onClick={() => setPickHits(null)}
          >
            {t.nameSearchPickClose}
          </button>
        </AppDialogActions>
      </Dialog>
    </div>
  )
}
