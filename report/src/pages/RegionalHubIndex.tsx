import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useId, useState } from 'react'
import type { GermanKeyLookupBundle } from '../../../scripts/shared/germanKeyLookupPayload.ts'
import type { RegionalHubMismatchFlag } from '../../../scripts/shared/regionalHubPayload.ts'
import { AlertNotice } from '../components/AlertNotice'
import {
  AppDialogActions,
  AppDialogBody,
  AppDialogDescription,
  AppDialogHeader,
  AppDialogHeaderLeadSlot,
  AppDialogHeaderSeparator,
  AppDialogHeaderTitleSlot,
  AppDialogTitle,
  Dialog,
} from '../components/ui/Dialog'
import {
  germanKeyLookupQueryOptions,
  regionalHubManifestQueryOptions,
  regionalHubMismatchFlagsQueryOptions,
} from '../data/load'
import { de } from '../i18n/de'
import { formatSnapshotDateLabelDe } from '../lib/formatSourceDownloadedAt'
import {
  isGermanKeyDigitHeavyInput,
  resolveArsFromAgs,
  searchGermanKeyDisplayNames,
  type GermanKeyNameSearchHit,
} from '../lib/germanKeyLookupBundle'
import { padRegional12 } from '../lib/regionalHubDisplay'

const t = de.regionalHub

function statusLabel(flag: RegionalHubMismatchFlag | undefined): string | null {
  if (!flag) return null
  switch (flag) {
    case 'osm_wikidata':
      return t.statusOsmWikidata
    case 'osm_population':
      return t.statusOsmPopulation
    case 'wikidata_population':
      return t.statusWikidataPopulation
    case 'wikidata_p402':
      return t.statusWikidataP402
  }
}

function provenanceLabel(raw: string | undefined): string {
  if (!raw) return t.provenanceUnknown
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return formatSnapshotDateLabelDe(raw.slice(0, 10))
  try {
    return formatSnapshotDateLabelDe(raw)
  } catch {
    return raw
  }
}

export function RegionalHubIndex() {
  const formId = useId()
  const navigate = useNavigate()
  const lookupQuery = useQuery(germanKeyLookupQueryOptions())
  const manifestQuery = useQuery(regionalHubManifestQueryOptions())
  const flagsQuery = useQuery(regionalHubMismatchFlagsQueryOptions())
  const [feedback, setFeedback] = useState<string | null>(null)
  const [pickHits, setPickHits] = useState<GermanKeyNameSearchHit[] | null>(null)
  const [filter, setFilter] = useState<'all' | 'action'>('all')
  const [openLand, setOpenLand] = useState<string | null>(null)

  function goToArs(raw: string) {
    const ars = padRegional12(raw)
    if (!ars) return
    void navigate({ to: '/regional/$ars', params: { ars } })
  }

  function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault()
    setFeedback(null)
    const submitted = String(new FormData(ev.currentTarget).get('hubKey') ?? '').trim()
    if (submitted === '') return
    if (isGermanKeyDigitHeavyInput(submitted)) {
      goToArs(submitted)
      return
    }
    const bundle = lookupQuery.data
    if (!bundle) return
    const hits = searchGermanKeyDisplayNames(bundle, submitted)
    if (hits.length === 0) {
      setFeedback(t.searchNoResults)
      return
    }
    if (hits.length === 1) {
      applyHit(hits[0]!)
      return
    }
    setPickHits(hits)
  }

  function applyHit(hit: GermanKeyNameSearchHit) {
    const bundle = lookupQuery.data
    if (hit.kind === 'ars') {
      goToArs(hit.id)
      return
    }
    const resolved = bundle ? resolveArsFromAgs(bundle, hit.id) : null
    goToArs(resolved?.ars12 ?? hit.id)
  }

  const flags = flagsQuery.data?.byArs ?? {}
  const bundle = lookupQuery.data
  const lands = bundle
    ? Object.entries(bundle.latest.bundeslaender).sort(([a], [b]) => a.localeCompare(b))
    : []

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 text-left sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-700 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">{t.lead}</p>
        <p className="mt-3 text-xs text-slate-500">
          {t.provenanceLine(
            provenanceLabel(
              manifestQuery.data?.destatis.populationDate ?? bundle?.latest.populationDate,
            ),
            provenanceLabel(manifestQuery.data?.osm.generatedAt),
            provenanceLabel(manifestQuery.data?.wikidata.generatedAt),
          )}
        </p>
        <p className="mt-3 text-sm">
          <Link
            to="/tools/german-key"
            className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
          >
            {t.decodeLink}
          </Link>
        </p>
      </header>

      <form className="space-y-4" onSubmit={submit}>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[min(100%,20rem)] flex-1">
            <label className="block text-sm font-medium text-slate-200" htmlFor={`${formId}-key`}>
              {t.searchLabel}
            </label>
            <input
              id={`${formId}-key`}
              name="hubKey"
              type="text"
              className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
              placeholder={t.searchPlaceholder}
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            {t.searchSubmit}
          </button>
        </div>
      </form>
      {feedback ? <p className="mt-3 text-sm text-slate-400">{feedback}</p> : null}

      {flagsQuery.data ? (
        <fieldset className="mt-8">
          <legend className="text-sm font-medium text-slate-200">{t.filterLabel}</legend>
          <div className="mt-2 flex gap-3 text-sm">
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="radio"
                name="hub-filter"
                checked={filter === 'all'}
                onChange={() => setFilter('all')}
              />
              {t.filterAll}
            </label>
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="radio"
                name="hub-filter"
                checked={filter === 'action'}
                onChange={() => setFilter('action')}
              />
              {t.filterAction}
            </label>
          </div>
        </fieldset>
      ) : null}

      <p className="mt-8 text-sm text-slate-500">{t.landAccordionHint}</p>
      {lookupQuery.isPending ? (
        <p className="mt-4 text-sm text-slate-500">{de.germanKeyExplorer.loadingLookup}</p>
      ) : lookupQuery.isError ? (
        <AlertNotice>
          <p>{de.germanKeyExplorer.lookupErrorPrefix}</p>
        </AlertNotice>
      ) : (
        <ul className="mt-4 space-y-2">
          {lands.map(([code, name]) => {
            const landArs = padRegional12(code) ?? `${code}0000000000`
            return (
              <li key={code} className="rounded-lg border border-slate-700 bg-slate-900/40">
                <details
                  className="group"
                  open={openLand === code}
                  onToggle={(ev) => {
                    const el = ev.currentTarget
                    setOpenLand(el.open ? code : openLand === code ? null : openLand)
                  }}
                >
                  <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-100">
                    <span className="font-mono text-xs text-slate-400">{code}</span> {name}
                  </summary>
                  {openLand === code && bundle ? (
                    <LandChildren
                      landCode={code}
                      landArs={landArs}
                      landName={name}
                      bundle={bundle}
                      flags={flags}
                      filter={filter}
                    />
                  ) : null}
                </details>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={pickHits != null} onClose={() => setPickHits(null)}>
        <AppDialogHeader>
          <AppDialogHeaderTitleSlot>
            <AppDialogTitle>{t.searchPickTitle}</AppDialogTitle>
          </AppDialogHeaderTitleSlot>
          <AppDialogHeaderLeadSlot>
            <AppDialogDescription>{t.searchPickLead}</AppDialogDescription>
          </AppDialogHeaderLeadSlot>
          <AppDialogHeaderSeparator />
        </AppDialogHeader>
        <AppDialogBody>
          <ul className="space-y-2 text-sm">
            {(pickHits ?? []).map((hit) => (
              <li key={`${hit.kind}:${hit.id}`}>
                <button
                  type="button"
                  className="text-left text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                  onClick={() => {
                    applyHit(hit)
                    setPickHits(null)
                  }}
                >
                  {hit.displayName}{' '}
                  <span className="font-mono text-xs text-slate-400">{hit.id}</span>
                </button>
              </li>
            ))}
          </ul>
        </AppDialogBody>
        <AppDialogActions>
          <button
            type="button"
            className="text-sm text-slate-400"
            onClick={() => setPickHits(null)}
          >
            {t.searchPickClose}
          </button>
        </AppDialogActions>
      </Dialog>
    </div>
  )
}

function LandChildren({
  landCode,
  landArs,
  landName,
  bundle,
  flags,
  filter,
}: {
  landCode: string
  landArs: string
  landName: string
  bundle: GermanKeyLookupBundle
  flags: Record<string, RegionalHubMismatchFlag>
  filter: 'all' | 'action'
}) {
  const rows: { ars: string; name: string }[] = [{ ars: landArs, name: landName }]
  for (const [key, name] of Object.entries(bundle.latest.kreise)) {
    if (!key.startsWith(landCode)) continue
    const ars = padRegional12(key)
    if (ars) rows.push({ ars, name })
  }
  for (const [ars, name] of Object.entries(bundle.latest.gemeindenByArs)) {
    if (!ars.startsWith(landCode)) continue
    rows.push({ ars, name })
  }
  const seen = new Set<string>()
  const unique = rows.filter((row) => {
    if (seen.has(row.ars)) return false
    seen.add(row.ars)
    return true
  })
  const visible =
    filter === 'action' ? unique.filter((row) => flags[row.ars] !== undefined) : unique
  if (visible.length === 0) {
    return <p className="px-4 pb-4 text-sm text-slate-500">{t.emptyBrowse}</p>
  }
  return (
    <ul className="max-h-[32rem] overflow-auto border-t border-slate-800 px-2 py-2 text-sm">
      {visible.map((row) => {
        const chip = statusLabel(flags[row.ars])
        return (
          <li key={row.ars}>
            <Link
              to="/regional/$ars"
              params={{ ars: row.ars }}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded px-2 py-1.5 text-slate-200 hover:bg-slate-800/70"
            >
              <span>
                {row.name} <span className="font-mono text-xs text-slate-500">{row.ars}</span>
              </span>
              {chip ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200">
                  {chip}
                </span>
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
