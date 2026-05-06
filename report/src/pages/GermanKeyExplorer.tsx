import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { GermanKeyExplorerContent } from '../components/germanKeyExplorer/GermanKeyExplorerContent'
import { germanKeyLookupQueryOptions } from '../data/load'
import { de } from '../i18n/de'
import {
  germanKeyExplorerHeaderSources,
  germanKeyLatestSnapshotLabelDe,
} from '../lib/germanKeyLookupBundle'
import type { GermanKeySearch } from '../lib/germanKeySearch'

export function GermanKeyExplorer() {
  const search = useSearch({ strict: false }) as GermanKeySearch
  const navigate = useNavigate()

  const lookupQuery = useQuery(germanKeyLookupQueryOptions())

  function navigateGermanKey(next: GermanKeySearch) {
    navigate({
      to: '/tools/german-key',
      search: next,
    })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-left sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-700 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
          {de.germanKeyExplorer.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          {de.germanKeyExplorer.lead}
        </p>

        {lookupQuery.isPending ? (
          <p className="mt-4 text-sm text-slate-500">{de.germanKeyExplorer.loadingLookup}</p>
        ) : lookupQuery.isError ? (
          <p className="mt-4 text-sm text-amber-300">
            {de.germanKeyExplorer.lookupErrorPrefix}{' '}
            {lookupQuery.error instanceof Error ? lookupQuery.error.message : String(lookupQuery.error)}
          </p>
        ) : lookupQuery.data ? (
          <>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
              {de.germanKeyExplorer.sourcesIntroLead}
            </p>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">
              <span className="text-slate-400">{de.germanKeyExplorer.sourcesDataSourcesLabel}</span>{' '}
              {germanKeyExplorerHeaderSources(lookupQuery.data).map((src, index) => (
                <span key={src.href}>
                  {index > 0 ? ', ' : null}
                  <a
                    href={src.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                  >
                    {src.label}
                  </a>
                </span>
              ))}
              <span className="text-slate-500">
                {' '}
                {de.germanKeyExplorer.sourcesIntroLatestSnapshot(
                  germanKeyLatestSnapshotLabelDe(lookupQuery.data),
                )}
              </span>
            </p>
          </>
        ) : null}
      </header>

      {lookupQuery.data ? (
        <GermanKeyExplorerContent
          bundle={lookupQuery.data}
          search={search}
          onApplySearch={(next) => {
            navigateGermanKey(next)
          }}
        />
      ) : null}
    </div>
  )
}
