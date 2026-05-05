import { useNavigate, useSearch } from '@tanstack/react-router'
import { GermanKeyExplorerContent } from '../components/germanKeyExplorer/GermanKeyExplorerContent'
import germanKeyLookup from '../data/germanKeyLookup.gen'
import { de } from '../i18n/de'
import type { GermanKeySearch } from '../lib/germanKeySearch'

const DESTATIS_GEMEINDEVERZEICHNIS_SOURCE_URL =
  'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/_inhalt.html#124272'

export function GermanKeyExplorer() {
  const search = useSearch({ strict: false }) as GermanKeySearch
  const navigate = useNavigate()
  const sourceDate = germanKeyLookup.source.snapshotDate ?? germanKeyLookup.checkedAt
  const sourceDateLabel = Number.isNaN(new Date(sourceDate).getTime())
    ? sourceDate
    : new Date(sourceDate).toLocaleDateString('de-DE')

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-left sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-700 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
          {de.germanKeyExplorer.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          {de.germanKeyExplorer.lead}
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
          {de.germanKeyExplorer.dataSourcePrefix} {de.germanKeyExplorer.dataSourceLinkIntro}{' '}
          <a
            href={DESTATIS_GEMEINDEVERZEICHNIS_SOURCE_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
          >
            {de.germanKeyExplorer.dataSourceLinkLabel}
          </a>
          . {de.germanKeyExplorer.dataSourceDateLabel(sourceDateLabel)}
        </p>
      </header>
      <GermanKeyExplorerContent
        key={`${search.key ?? ''}\0${search.area ?? ''}`}
        search={search}
        onApplySearch={(next) => {
          navigate({
            to: '/tools/german-key',
            search: next,
            replace: true,
          })
        }}
      />
    </div>
  )
}
