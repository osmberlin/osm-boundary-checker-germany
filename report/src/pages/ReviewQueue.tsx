import { Link, useNavigate } from '@tanstack/react-router'
import { StatBlock, StatBlocksRow } from '../components/FeatureStatBlocks'
import { IssueBadge } from '../components/IssueBadge'
import { ReportCategoryPill } from '../components/reportCategoryStyles'
import { reviewQueue } from '../data/reviewQueue'
import { categoryLabelDe, de } from '../i18n/de'
import { formatDeInteger } from '../lib/formatDe'

export function ReviewQueue() {
  const nonEmptyAreas = reviewQueue.filter(
    (area) => area.reviewEntries.length > 0 || area.issueEntries.length > 0,
  )
  const totalIssues = nonEmptyAreas.reduce((sum, area) => sum + area.issueEntries.length, 0)
  const totalReviews = nonEmptyAreas.reduce((sum, area) => sum + area.reviewEntries.length, 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-left sm:px-6 lg:px-8">
      <p className="mb-6 max-w-prose text-pretty text-slate-400">{de.review.intro}</p>

      <section className="mb-6 rounded border border-slate-700 bg-slate-900 p-4">
        <StatBlocksRow aria-label={de.review.totalStatsAria}>
          <StatBlock label={de.review.datasetCount} value={formatDeInteger(nonEmptyAreas.length)} />
          <StatBlock
            label={<span className="text-amber-200">{de.review.reviewsCount}</span>}
            value={<span className="text-amber-200">{formatDeInteger(totalReviews)}</span>}
          />
          <StatBlock
            label={<span className="text-rose-200">{de.review.issuesCount}</span>}
            value={<span className="text-rose-200">{formatDeInteger(totalIssues)}</span>}
          />
        </StatBlocksRow>
      </section>

      {nonEmptyAreas.length === 0 ? (
        <p className="text-slate-400">{de.review.empty}</p>
      ) : (
        <div className="space-y-8">
          {nonEmptyAreas.map((area) => (
            <section
              key={area.area}
              className="rounded border border-slate-700 bg-slate-900/40 p-4"
              aria-label={area.displayName}
            >
              <h2 className="mb-3 text-lg font-semibold text-slate-100">
                <Link
                  to="/$areaId"
                  params={{ areaId: area.area }}
                  className="text-sky-400 underline decoration-sky-400/30 underline-offset-2 hover:text-sky-300 hover:decoration-sky-300/40"
                >
                  {area.displayName}
                </Link>
                <span className="ml-2 text-sm font-normal text-slate-400">
                  ({formatDeInteger(area.reviewEntries.length + area.issueEntries.length)}{' '}
                  {de.review.sectionCountSuffix})
                </span>
              </h2>

              {area.issueEntries.length > 0 ? (
                <ReviewTopicTable areaId={area.area} level="issue" entries={area.issueEntries} />
              ) : null}
              {area.reviewEntries.length > 0 ? (
                <ReviewTopicTable areaId={area.area} level="review" entries={area.reviewEntries} />
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

type ReviewTopicTableProps = {
  areaId: string
  level: 'review' | 'issue'
  entries: Array<{
    canonicalMatchKey: string
    nameLabel: string
    category: 'matched' | 'official_only'
  }>
}

function ReviewTopicTable({ areaId, level, entries }: ReviewTopicTableProps) {
  const navigate = useNavigate()
  return (
    <div className="mb-4 last:mb-0">
      <h3 className="mb-2 text-sm font-semibold text-slate-200">
        <IssueBadge level={level} /> <span className="ml-2">{formatDeInteger(entries.length)}</span>
      </h3>
      <div className="overflow-x-auto rounded border border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-3 py-2 text-left text-slate-100">{de.review.table.name}</th>
              <th className="px-3 py-2 text-left text-slate-100">{de.review.table.key}</th>
              <th className="px-3 py-2 text-left text-slate-100">{de.review.table.category}</th>
              <th className="px-3 py-2 text-left text-slate-100">{de.review.table.issueLevel}</th>
              <th className="px-3 py-2 text-right text-slate-100">{de.review.table.view}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((row) => (
              <tr
                key={`${level}-${row.canonicalMatchKey}`}
                className="group cursor-pointer border-t border-slate-800/80 transition-colors focus-within:bg-slate-800/55 hover:bg-slate-800/55"
                tabIndex={0}
                onClick={() => {
                  void navigate({
                    to: '/$areaId/feature/$featureKey',
                    params: { areaId, featureKey: row.canonicalMatchKey },
                  })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    void navigate({
                      to: '/$areaId/feature/$featureKey',
                      params: { areaId, featureKey: row.canonicalMatchKey },
                    })
                  }
                }}
              >
                <td className="px-3 py-2 text-slate-100">{row.nameLabel}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-100">
                  {row.canonicalMatchKey}
                </td>
                <td className="px-3 py-2">
                  <ReportCategoryPill category={row.category}>
                    {categoryLabelDe(row.category)}
                  </ReportCategoryPill>
                </td>
                <td className="px-3 py-2">
                  <IssueBadge level={level} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to="/$areaId/feature/$featureKey"
                    params={{ areaId, featureKey: row.canonicalMatchKey }}
                    className="inline-flex items-center text-slate-500 transition-colors group-hover:text-sky-300 focus-visible:text-sky-300"
                    aria-label={`${de.review.table.view}: ${row.nameLabel}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="sr-only">{de.review.table.view}</span>
                    <span aria-hidden>→</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
