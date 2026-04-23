import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { StatBlock, StatBlocksRow } from '../components/FeatureStatBlocks'
import { ReportCategoryPill, UnmatchedOsmStatPill } from '../components/reportCategoryStyles'
import { areasIndexQueryOptions } from '../data/areasIndexQuery'
import { categoryLabelDe, de } from '../i18n/de'
import { EM_DASH, formatDeInteger } from '../lib/formatDe'

export function Home() {
  const areasQuery = useQuery(areasIndexQueryOptions())
  const areas = areasQuery.data?.areas ?? []
  const summariesByArea = Object.fromEntries(
    (areasQuery.data?.summaries ?? []).map((entry) => [entry.area, entry]),
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-left sm:px-6 lg:px-8">
      <p className="mb-3">
        <Link className="text-sky-400 underline hover:text-sky-300" to="/status">
          {de.home.processingStatusLink}
        </Link>
      </p>
      <p className="mb-4 max-w-prose text-pretty text-slate-400">{de.home.introP1}</p>
      <p className="mb-6 max-w-prose text-pretty text-slate-400">{de.home.introP2}</p>
      <p className="mb-6 text-slate-400">
        {de.home.leadBefore}{' '}
        <code className="rounded bg-slate-800 px-1 text-slate-200">output/</code>{' '}
        {de.home.leadAfter}
      </p>
      {areasQuery.isPending ? (
        <p className="text-slate-400">{de.home.loadingAreas}</p>
      ) : areasQuery.isError ? (
        <p className="text-amber-200">{de.home.areasError}</p>
      ) : areas.length === 0 ? (
        <p className="text-slate-400">{de.home.noAreas}</p>
      ) : (
        <ul className="space-y-4">
          {areas.map((a) => {
            const entry = summariesByArea[a]
            const displayName = entry?.displayName ?? a
            const matched = entry ? formatDeInteger(entry.matched) : EM_DASH
            const officialOnly = entry ? formatDeInteger(entry.officialOnly) : EM_DASH
            const unmatched = entry ? formatDeInteger(entry.unmatchedOsm) : EM_DASH
            return (
              <li key={a}>
                <Link
                  className="group block rounded border border-slate-700 bg-slate-900 p-4 transition-colors hover:border-slate-500 hover:bg-slate-800/60"
                  to="/$areaId"
                  params={{ areaId: a }}
                  title={a}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-sky-400 underline group-hover:text-sky-300">
                      {displayName}
                    </span>
                    <span
                      className="text-slate-500 transition-colors group-hover:text-sky-300"
                      aria-hidden
                    >
                      →
                    </span>
                  </div>
                  <StatBlocksRow className="mt-4" aria-label={de.home.categoryStatsAria}>
                    <StatBlock
                      label={
                        <ReportCategoryPill category="matched">
                          {categoryLabelDe('matched')}
                        </ReportCategoryPill>
                      }
                      value={matched}
                    />
                    <StatBlock
                      label={
                        <ReportCategoryPill category="official_only">
                          {categoryLabelDe('official_only')}
                        </ReportCategoryPill>
                      }
                      value={officialOnly}
                    />
                    <StatBlock
                      label={<UnmatchedOsmStatPill>{de.home.unmatchedStat}</UnmatchedOsmStatPill>}
                      value={unmatched}
                    />
                  </StatBlocksRow>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
