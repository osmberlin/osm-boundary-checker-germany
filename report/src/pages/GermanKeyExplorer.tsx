import { useNavigate, useSearch } from '@tanstack/react-router'
import { useId } from 'react'
import { GermanKeyExplorerContent } from '../components/germanKeyExplorer/GermanKeyExplorerContent'
import germanKeyLookupBundle from '../data/germanKeyLookup.gen'
import { de } from '../i18n/de'
import type { GermanKeyLookupTables } from '../lib/germanKeyExplorer'
import type { GermanKeySearch } from '../lib/germanKeySearch'

function lookupTablesFromDataset(ds: {
  bundeslaender: Record<string, string>
  regierungsbezirke: Record<string, string>
  kreise: Record<string, string>
  gemeindeverbaende: Record<string, string>
  gemeindenByAgs: Record<string, string>
  gemeindenByArs: Record<string, string>
}): GermanKeyLookupTables {
  return {
    bundeslaender: ds.bundeslaender,
    regierungsbezirke: ds.regierungsbezirke,
    kreise: ds.kreise,
    gemeindeverbaende: ds.gemeindeverbaende,
    gemeindenByAgs: ds.gemeindenByAgs,
    gemeindenByArs: ds.gemeindenByArs,
  }
}

function formatSnapshotDe(snapshotDate: string): string {
  return Number.isNaN(new Date(snapshotDate).getTime())
    ? snapshotDate
    : new Date(snapshotDate).toLocaleDateString('de-DE')
}

type GermanKeyDatasetKey = keyof typeof germanKeyLookupBundle.datasets

function resolveActiveDatasetKey(search: GermanKeySearch): GermanKeyDatasetKey {
  const requested = search.gvDataset
  const datasets = germanKeyLookupBundle.datasets
  if (requested !== undefined && requested in datasets) {
    return requested as GermanKeyDatasetKey
  }
  return germanKeyLookupBundle.defaultDatasetId
}

export function GermanKeyExplorer() {
  const search = useSearch({ strict: false }) as GermanKeySearch
  const navigate = useNavigate()
  const datasetSelectId = useId()

  const activeDatasetKey = resolveActiveDatasetKey(search)

  const dataset = germanKeyLookupBundle.datasets[activeDatasetKey]
  const lookupTables = lookupTablesFromDataset(dataset)
  const sourceDateLabel = formatSnapshotDe(dataset.source.snapshotDate)

  function navigateGermanKey(next: GermanKeySearch) {
    navigate({
      to: '/tools/german-key',
      search: next,
      replace: true,
    })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-left sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-700 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight text-slate-100">
            {de.germanKeyExplorer.title}
          </h1>
          <div className="w-full shrink-0 sm:w-auto sm:min-w-[14rem]">
            <label className="sr-only" htmlFor={datasetSelectId}>
              {de.germanKeyExplorer.datasetPickerAria}
            </label>
            <select
              id={datasetSelectId}
              aria-label={de.germanKeyExplorer.datasetPickerAria}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
              value={activeDatasetKey}
              onChange={(event) => {
                const nextId = event.target.value
                const nextSearch: GermanKeySearch = {}
                if (search.key) nextSearch.key = search.key
                if (search.area) nextSearch.area = search.area
                if (search.preset) nextSearch.preset = search.preset
                if (nextId !== germanKeyLookupBundle.defaultDatasetId) {
                  nextSearch.gvDataset = nextId
                }
                navigateGermanKey(nextSearch)
              }}
            >
              {germanKeyLookupBundle.datasetIds.map((id) => {
                const ds = germanKeyLookupBundle.datasets[id]
                const label = `${ds.label} · ${formatSnapshotDe(ds.source.snapshotDate)}`
                return (
                  <option key={id} value={id}>
                    {label}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          {de.germanKeyExplorer.lead}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
          {de.germanKeyExplorer.dataSourcePrefix} {de.germanKeyExplorer.dataSourceLinkIntro}{' '}
          <a
            href={dataset.sourcePublicUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
          >
            {de.germanKeyExplorer.dataSourceLinkLabel}
          </a>
          . {de.germanKeyExplorer.dataSourceDateLabel(sourceDateLabel)}
        </p>
        {dataset.provenanceLines.length > 0 ? (
          <ul className="mt-2 max-w-3xl list-inside list-disc space-y-1 text-sm text-slate-500">
            {dataset.provenanceLines.map((line: string) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </header>
      <GermanKeyExplorerContent
        key={`${search.key ?? ''}\0${search.area ?? ''}`}
        lookupTables={lookupTables}
        search={search}
        onApplySearch={(next) => {
          navigateGermanKey(next)
        }}
      />
    </div>
  )
}
