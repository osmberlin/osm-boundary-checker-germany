import { useQuery } from '@tanstack/react-query'
import { ChangelogList } from '@tordans/changelog-kit/react'
import { RouteLoadingPane } from '../components/RouteLoadingPane'
import { changelogQueryOptions } from '../data/load'
import { de } from '../i18n/de'
import { githubCommitUrl } from '../lib/githubRepo'

export function Changelog() {
  const q = useQuery(changelogQueryOptions())

  if (q.isLoading) {
    return <RouteLoadingPane title={de.routeLoading.changelog} />
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">
          {de.changelog.heading}
        </h1>
      </header>

      {q.isError ? <p className="text-amber-200">{de.changelog.error}</p> : null}
      {q.isSuccess && q.data == null ? (
        <p className="text-slate-400">{de.changelog.empty}</p>
      ) : null}
      {q.isSuccess && q.data != null ? (
        <div className="text-slate-200">
          <ChangelogList
            data={q.data}
            commitUrl={githubCommitUrl}
            labels={{ empty: de.changelog.empty }}
          />
        </div>
      ) : null}
    </div>
  )
}
