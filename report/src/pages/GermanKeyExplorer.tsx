import { useNavigate, useSearch } from '@tanstack/react-router'
import { GermanKeyExplorerContent } from '../components/germanKeyExplorer/GermanKeyExplorerContent'
import { de } from '../i18n/de'
import type { GermanKeySearch } from '../lib/germanKeySearch'

export function GermanKeyExplorer() {
  const search = useSearch({ strict: false }) as GermanKeySearch
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-left sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-700 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
          {de.germanKeyExplorer.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          {de.germanKeyExplorer.lead}
        </p>
      </header>
      <GermanKeyExplorerContent
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
