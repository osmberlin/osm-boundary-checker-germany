import { useId, useState } from 'react'
import type { GermanKeyLookupBundle } from '../../../../scripts/shared/germanKeyLookupPayload.ts'
import { de } from '../../i18n/de'
import {
  ags8FromArs12Digits,
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
  agsSegmentCells,
  collectObsoleteFields,
  isGermanKeyDigitHeavyInput,
  lookupArsSegmentNameCells,
  mergeGermanKeyLookupTables,
  resolveArsFromAgs,
  resolveGemeindeNameByAgs,
  resolveGemeindeNameByArs,
  searchGermanKeyDisplayNames,
  type ArsSegmentNameCells,
  type GermanKeyNameSearchHit,
  type ObsoleteMeta,
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
import { ArsSegmentsTable, type SegmentsTableRow } from './ArsSegmentsTable'

type SegmentsBase =
  | { kind: 'ars12'; ars12: string }
  | {
      kind: 'ags8'
      ags8: string
      resolvedArs: { ars12: string; obsolete?: ObsoleteMeta } | null
    }
  | null

function buildArsViewRows(ars12: string, cells: ArsSegmentNameCells): SegmentsTableRow[] {
  const t = de.germanKeyExplorer
  const segments = parseArs12Segments(ars12)
  if (!segments) return []
  return [
    {
      label: t.segmentBl,
      shortCode: 'LL',
      digits: segments.bundesland,
      span: '1–2',
      startPos: 1,
      endPos: 2,
      resolved: cells.bundesland,
      fallbackLabel: null,
    },
    {
      label: t.segmentRb,
      shortCode: 'R',
      digits: segments.regierungsbezirk,
      span: '3',
      startPos: 3,
      endPos: 3,
      resolved: cells.regierungsbezirk,
      fallbackLabel: segments.regierungsbezirk === '0' ? t.noRegierungsbezirk : null,
    },
    {
      label: t.segmentKreis,
      shortCode: 'KK',
      digits: segments.kreis,
      span: '4–5',
      startPos: 4,
      endPos: 5,
      resolved: cells.kreis,
      fallbackLabel: null,
    },
    {
      label: t.segmentVg,
      shortCode: 'VVVV',
      digits: segments.gemeindeverband,
      span: '6–9',
      startPos: 6,
      endPos: 9,
      resolved: cells.gemeindeverband,
      fallbackLabel: segments.gemeindeverband === '0000' ? t.noGemeindeverband : null,
    },
    {
      label: t.segmentGem,
      shortCode: 'GGG',
      digits: segments.gemeinde,
      span: '10–12',
      startPos: 10,
      endPos: 12,
      resolved: cells.gemeinde,
      fallbackLabel: null,
    },
  ]
}

function buildAgsViewRows(
  ags8: string,
  cells: ArsSegmentNameCells,
  resolvedArs: { ars12: string } | null,
): SegmentsTableRow[] {
  const t = de.germanKeyExplorer
  return [
    {
      label: t.segmentBl,
      shortCode: 'LL',
      digits: ags8.slice(0, 2),
      span: '1–2',
      startPos: 1,
      endPos: 2,
      resolved: cells.bundesland,
      fallbackLabel: null,
    },
    {
      label: t.segmentRb,
      shortCode: 'R',
      digits: ags8.slice(2, 3),
      span: '3',
      startPos: 3,
      endPos: 3,
      resolved: cells.regierungsbezirk,
      fallbackLabel: ags8.slice(2, 3) === '0' ? t.noRegierungsbezirk : null,
    },
    {
      label: t.segmentKreis,
      shortCode: 'KK',
      digits: ags8.slice(3, 5),
      span: '4–5',
      startPos: 4,
      endPos: 5,
      resolved: cells.kreis,
      fallbackLabel: null,
    },
    {
      label: t.segmentVg,
      shortCode: 'VVVV',
      digits: resolvedArs ? resolvedArs.ars12.slice(5, 9) : null,
      span: resolvedArs ? '6–9 (ARS)' : '—',
      startPos: 9,
      endPos: 9,
      resolved: cells.gemeindeverband,
      fallbackLabel: null,
      agsView: resolvedArs ? 'from-lookup' : 'not-in-ags',
    },
    {
      label: t.segmentGem,
      shortCode: 'GGG',
      digits: ags8.slice(5, 8),
      span: '6–8',
      startPos: 6,
      endPos: 8,
      resolved: cells.gemeinde,
      fallbackLabel: null,
    },
  ]
}

/** Pretty layout line for the explainer block: groups slots with single-space separators. */
function formatLayoutDigits(parts: string[]): string {
  return parts.join(' ')
}

function explainerAgsLine(d: string, agsFromInput: string | null): string {
  const ags = agsFromInput ?? (d.length >= 8 ? d.slice(0, 8) : d)
  const padded = ags.padEnd(8, '?')
  return formatLayoutDigits([
    padded.slice(0, 2),
    padded.slice(2, 3),
    padded.slice(3, 5),
    padded.slice(5, 8),
  ])
}

function explainerArsLine(
  d: string,
  padded12: string,
  resolvedArs: { ars12: string } | null,
): string {
  let ars: string
  if (d.length >= 12) {
    ars = d.slice(0, 12)
  } else if (d.length === 8) {
    if (resolvedArs) {
      ars = resolvedArs.ars12
    } else {
      ars = `${d.slice(0, 5)}????${d.slice(5, 8)}`
    }
  } else if (d.length > 0) {
    const real = padded12.slice(0, d.length)
    const padding = '?'.repeat(12 - d.length)
    ars = `${real}${padding}`
  } else {
    ars = '????????????'
  }
  return formatLayoutDigits([
    ars.slice(0, 2),
    ars.slice(2, 3),
    ars.slice(3, 5),
    ars.slice(5, 9),
    ars.slice(9, 12),
  ])
}

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

  /**
   * Reverse lookup AGS → full ARS for 8-digit input. Avoids the right-padding bug that maps
   * the AGS's GGG into the ARS's VVVV slot. See `resolveArsFromAgs` and Part A of the explorer plan.
   */
  const resolvedFromAgs = d.length === 8 ? resolveArsFromAgs(bundle, d) : null

  const segmentsBase: SegmentsBase =
    d.length >= 12
      ? { kind: 'ars12', ars12: d.slice(0, 12) }
      : d.length === 8
        ? { kind: 'ags8', ags8: d, resolvedArs: resolvedFromAgs }
        : d.length > 0
          ? { kind: 'ars12', ars12: padded12 }
          : null

  const segmentCells: ArsSegmentNameCells | null =
    segmentsBase === null
      ? null
      : segmentsBase.kind === 'ars12'
        ? lookupArsSegmentNameCells(bundle, segmentsBase.ars12)
        : agsSegmentCells(bundle, segmentsBase.ags8, segmentsBase.resolvedArs)

  const segmentRows: SegmentsTableRow[] =
    segmentsBase === null || segmentCells === null
      ? []
      : segmentsBase.kind === 'ars12'
        ? buildArsViewRows(segmentsBase.ars12, segmentCells)
        : buildAgsViewRows(segmentsBase.ags8, segmentCells, segmentsBase.resolvedArs)

  const segmentsTitle = segmentsBase?.kind === 'ags8' ? t.agsTableTitle : t.arsTableTitle

  const ags8From12 = d.length >= 12 ? ags8FromArs12Digits(d) : d.length >= 8 ? d.slice(0, 8) : null
  const agsForPortal =
    ags8From12 !== null && ags8From12.length === 8 ? ags8From12 : d.length === 8 ? d : null

  const berlin = tryBerlinBezirkCanonical5(raw)

  const rows = raw !== '' ? normalizationsForSchluesselExplorerTable(raw) : []

  /**
   * For the keyOverview ARS row: when input is 8-digit AGS, prefer the resolved ARS (so the user
   * never sees the bogus right-padded `120735320000`). For all other lengths, use `padded12` as today.
   */
  const arsRowDisplay: {
    value: string
    resolved: { value: string | null; obsolete?: ObsoleteMeta }
  } =
    d.length === 8
      ? resolvedFromAgs
        ? {
            value: resolvedFromAgs.ars12,
            resolved: resolveGemeindeNameByArs(bundle, resolvedFromAgs.ars12),
          }
        : { value: '—', resolved: { value: null } }
      : padded12.length >= 12
        ? {
            value: padded12,
            resolved: resolveGemeindeNameByArs(bundle, padded12),
          }
        : { value: padded12 || '—', resolved: { value: null } }

  const agsResolved =
    ags8From12 !== null && ags8From12.length === 8
      ? resolveGemeindeNameByAgs(bundle, ags8From12)
      : d.length === 8
        ? resolveGemeindeNameByAgs(bundle, d)
        : { value: null as string | null }

  const obsoleteMetaFields = [
    ...(segmentCells ? Object.values(segmentCells) : []),
    ...(arsRowDisplay.resolved.value !== null ? [arsRowDisplay.resolved] : []),
    ...(agsResolved.value !== null ? [agsResolved] : []),
  ]
  const obsoletePublications = collectObsoleteFields(obsoleteMetaFields)

  const keyOverviewRows = [
    {
      value: arsRowDisplay.value,
      valueSuffix: d.length === 8 && !resolvedFromAgs ? t.arsNotDerivableFromAgs : null,
      osmKey: 'de:regionalschluessel',
      bkgKey: 'ARS',
      length: '12',
      resolved: arsRowDisplay.resolved,
    },
    {
      value: ags8From12 ?? '—',
      valueSuffix: null as string | null,
      osmKey: 'de:amtlicher_gemeindeschluessel',
      bkgKey: 'AGS',
      length: '8',
      resolved: agsResolved,
    },
  ]

  function applyKeyToSearch(keyValue: string) {
    const next: GermanKeySearch = {}
    if (keyValue.trim() !== '') next.key = keyValue.trim()
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
            <h2 className="text-base font-semibold text-slate-100">{segmentsTitle}</h2>
            {segmentsBase?.kind === 'ags8' && !segmentsBase.resolvedArs ? (
              <AlertNotice>
                <p>{t.agsNotResolvable(segmentsBase.ags8)}</p>
              </AlertNotice>
            ) : null}
            <ArsSegmentsTable rows={segmentRows} originalDigitsLen={d.length} />
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
                      <td className="px-3 py-2 font-mono text-xs text-slate-100">
                        {row.value}
                        {row.valueSuffix ? (
                          <span className="ml-2 font-sans text-[11px] text-slate-500 italic">
                            {row.valueSuffix}
                          </span>
                        ) : null}
                      </td>
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

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-slate-100">{t.explainerLayoutTitle}</h2>
              <ul className="space-y-2 text-sm">
                <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-slate-300">{t.explainerLayoutSlotsAgs}</span>
                  <span className="text-slate-500">→</span>
                  <span className="font-mono text-slate-100">
                    {explainerAgsLine(d, ags8From12)}
                  </span>
                  <a
                    href="https://wiki.openstreetmap.org/wiki/DE:Key:de:amtlicher_gemeindeschluessel"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                  >
                    {t.explainerWikiAgsLinkLabel}
                  </a>
                </li>
                <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-slate-300">{t.explainerLayoutSlotsArs}</span>
                  <span className="text-slate-500">→</span>
                  <span className="font-mono text-slate-100">
                    {explainerArsLine(d, padded12, resolvedFromAgs)}
                  </span>
                  <a
                    href="https://wiki.openstreetmap.org/wiki/DE:Key:de:regionalschluessel"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                  >
                    {t.explainerWikiArsLinkLabel}
                  </a>
                </li>
              </ul>
              <p className="text-sm text-slate-400">{t.explainerPaddingArtifactPara1}</p>
              <p className="text-sm text-slate-400">{t.explainerPaddingArtifactPara2}</p>
            </section>
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

          {agsForPortal ? (
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-slate-100">{t.linksTitle}</h2>
              <ul className="list-inside list-disc space-y-1 text-sm text-slate-300">
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
              </ul>
            </section>
          ) : null}
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
