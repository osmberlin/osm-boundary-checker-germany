import { Link } from '@tanstack/react-router'
import { KpiCell, KpiRow } from '../components/FeatureStatBlocks'
import { ReportCategoryPill, UnmatchedOsmStatPill } from '../components/reportCategoryStyles'
import { areasIndex, type AreaLicenseSummary } from '../data/areasIndex'
import { categoryLabelDe, de } from '../i18n/de'
import { EM_DASH, formatDeInteger } from '../lib/formatDe'
import { withSiteBasePath } from '../lib/siteBasePath'

const GITHUB_REPO_ROOT = 'https://github.com/osmberlin/osm-boundary-checker-germany'
const GITHUB_ISSUES_NEW_URL = `${GITHUB_REPO_ROOT}/issues/new`
const LAUNCH_BLOGPOST_URL =
  'https://www.osm-verkehrswende.org/grenzabgleich/posts/grenzabgleich/'

const homeLinkClass =
  'font-medium text-sky-400 underline decoration-sky-400/30 underline-offset-2 hover:text-sky-300 hover:decoration-sky-300/40'

export function Home() {
  const areas = areasIndex.areas
  const summariesByArea = Object.fromEntries(
    areasIndex.summaries.map((entry) => [entry.area, entry]),
  )

  const logoSrc = withSiteBasePath('/osm-grenzabgleich-logo-2025.svg')

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-left sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0 flex-1 md:pr-2">
          <h1 className="mb-2 max-w-prose text-2xl font-semibold tracking-tight text-pretty text-slate-100 sm:text-3xl">
            {de.home.introHeading}
          </h1>
          <p className="mb-3 max-w-prose text-pretty text-slate-400">{de.home.introLead}</p>
          <p className="mb-3 max-w-prose text-slate-400">
            <a
              href={LAUNCH_BLOGPOST_URL}
              className={homeLinkClass}
              target="_blank"
              rel="noreferrer"
            >
              {de.home.launchBlogpostLinkLabel}
            </a>
          </p>
          <p className="text-slate-400">
            <a href={GITHUB_REPO_ROOT} className={homeLinkClass} target="_blank" rel="noreferrer">
              {de.home.githubCodeLinkLabel}
            </a>
            <span aria-hidden className="mx-1.5 text-slate-500">
              ·
            </span>
            <a
              href={GITHUB_ISSUES_NEW_URL}
              className={homeLinkClass}
              target="_blank"
              rel="noreferrer"
            >
              {de.home.githubIssuesLinkLabel}
            </a>
            <span aria-hidden className="mx-1.5 text-slate-500">
              ·
            </span>
            <Link to="/changelog" className={homeLinkClass}>
              {de.home.changelogLinkLabel}
            </Link>
            <span aria-hidden className="mx-1.5 text-slate-500">
              ·
            </span>
            <Link to="/review" className={homeLinkClass}>
              {de.home.reviewQueueLinkLabel}
            </Link>
          </p>
        </div>
        <div className="hidden shrink-0 justify-end pt-1 md:flex">
          <img
            src={logoSrc}
            alt=""
            width={200}
            height={120}
            className="max-h-32 max-w-[200px] object-contain object-right"
          />
        </div>
      </div>
      {areas.length === 0 ? (
        <p className="text-slate-400">{de.home.noAreas}</p>
      ) : (
        <>
          <ul className="space-y-4">
            {areas.map((a) => {
              const entry = summariesByArea[a]
              const displayName = entry?.displayName ?? a
              const matched = entry ? formatDeInteger(entry.matched) : EM_DASH
              const officialOnly = entry ? formatDeInteger(entry.officialOnly) : EM_DASH
              const unmatched = entry ? formatDeInteger(entry.unmatchedOsm) : EM_DASH
              const reviewsCountRaw = entry?.reviews ?? 0
              const issuesCountRaw = entry?.issues ?? 0
              const reviews = entry ? formatDeInteger(reviewsCountRaw) : EM_DASH
              const issues = entry ? formatDeInteger(issuesCountRaw) : EM_DASH
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
                    <KpiRow
                      className="mt-4"
                      narrowLayout="gridThreeTwoRows"
                      aria-label={de.home.categoryStatsAria}
                    >
                      <KpiCell
                        label={
                          <ReportCategoryPill category="matched">
                            {categoryLabelDe('matched')}
                          </ReportCategoryPill>
                        }
                        value={matched}
                      />
                      <KpiCell
                        label={
                          <ReportCategoryPill category="official_only">
                            {categoryLabelDe('official_only')}
                          </ReportCategoryPill>
                        }
                        value={officialOnly}
                      />
                      <KpiCell
                        label={<UnmatchedOsmStatPill>{de.home.unmatchedStat}</UnmatchedOsmStatPill>}
                        value={unmatched}
                      />
                      <KpiCell
                        label={
                          <span
                            className={reviewsCountRaw > 0 ? 'text-amber-200' : 'text-slate-400'}
                          >
                            {de.home.reviewsStat}
                          </span>
                        }
                        value={
                          <span className={reviewsCountRaw > 0 ? 'text-amber-200' : undefined}>
                            {reviews}
                          </span>
                        }
                      />
                      <KpiCell
                        label={
                          <span className={issuesCountRaw > 0 ? 'text-rose-300' : 'text-slate-400'}>
                            {de.home.issuesStat}
                          </span>
                        }
                        value={
                          <span className={issuesCountRaw > 0 ? 'text-rose-300' : undefined}>
                            {issues}
                          </span>
                        }
                      />
                    </KpiRow>
                  </Link>
                </li>
              )
            })}
          </ul>

          <HomeLicenseSection licenseSummaries={areasIndex.licenseSummaries} areaOrder={areas} />
        </>
      )}
    </div>
  )
}

function HomeLicenseSection({
  licenseSummaries,
  areaOrder,
}: {
  licenseSummaries: AreaLicenseSummary[]
  areaOrder: string[]
}) {
  const p = de.provenance
  if (licenseSummaries.length === 0) return null
  const byArea = new Map(licenseSummaries.map((summary) => [summary.area, summary]))
  const rows = areaOrder
    .map((area) => byArea.get(area))
    .filter((row): row is AreaLicenseSummary => row != null)
  if (rows.length === 0) return null

  return (
    <section className="mt-8 rounded border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400">
      <h2 className="mb-3 text-base font-semibold text-slate-100">{p.licenseSectionHeading}</h2>
      <div className="overflow-x-auto rounded border border-slate-700/70">
        <table className="min-w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-200">
            <tr>
              <th className="px-3 py-2">{de.areaReport.table.name}</th>
              <th className="px-3 py-2">{p.licenseShortNameLabel}</th>
              <th className="px-3 py-2">{p.osmCompatibilityLabelTitle}</th>
              <th className="px-3 py-2">{p.osmCompatibilitySourceLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.area} className="border-t border-slate-800/80">
                <td className="px-3 py-2">
                  <Link
                    to="/$areaId"
                    params={{ areaId: row.area }}
                    className="text-sky-400 underline"
                  >
                    {row.displayName}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  {row.officialLicenseLabel === 'unknown' ? p.unknown : row.officialLicenseLabel}
                  {row.officialLicenseSourceUrl ? (
                    <a
                      className="ml-2 text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
                      href={row.officialLicenseSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.licenseSourceLabel}
                    </a>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  {p.osmCompatibilityLabel[row.officialOsmCompatibility]}
                </td>
                <td className="px-3 py-2">
                  {row.officialOsmCompatibilitySourceUrl ? (
                    <a
                      className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
                      href={row.officialOsmCompatibilitySourceUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {p.sourceLinkLabel}
                    </a>
                  ) : (
                    p.unknown
                  )}
                  {row.officialOsmCompatibilityComment ? (
                    <span className="mt-1 block text-slate-500">
                      {row.officialOsmCompatibilityComment}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
