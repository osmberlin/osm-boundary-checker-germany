import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { KpiCell, KpiRow } from '../components/FeatureStatBlocks'
import { ReportCategoryLabel } from '../components/ReportCategoryLabel'
import { ReportCategoryPill, UnmatchedOsmStatPill } from '../components/reportCategoryStyles'
import { Abbr } from '../components/ui/Abbr'
import { areasIndex, type AreaLicenseSummary } from '../data/areasIndex'
import { categoryLabelDe, de } from '../i18n/de'
import { sourceText } from '../i18n/sourceVocabulary'
import { EM_DASH, formatDeInteger } from '../lib/formatDe'
import { HOME_GROUPS, groupAreasByHomeTheme } from '../lib/homeDatasetGroups'
import {
  OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25,
  officialLicenseTableMergeKey,
} from '../lib/officialSourceGroupKey'
import { compatibleShareLabel } from '../lib/resolveRowLicense'
import { withSiteBasePath } from '../lib/siteBasePath'

/** Homepage Prüfung / Problem: bright when non-zero, subdued when zero (no ampel pink). */
const homeAmpelKpiActiveClass = 'text-slate-50'
const homeAmpelKpiZeroClass = 'text-slate-600'

const GITHUB_REPO_ROOT = 'https://github.com/osmberlin/osm-boundary-checker-germany'
const GITHUB_ISSUES_NEW_URL = `${GITHUB_REPO_ROOT}/issues/new`
const LAUNCH_BLOGPOST_URL = 'https://www.osm-verkehrswende.org/grenzabgleich/posts/grenzabgleich/'

/** Theme headings above the dataset cards; groups come from each dataset's `osmProfile`. */
const homeLinkClass =
  'font-medium text-sky-400 underline decoration-sky-400/30 underline-offset-2 hover:text-sky-300 hover:decoration-sky-300/40'

/** Shared darker-blue panel behind Prüfung + Problem KPIs on homepage cards. */
function HomeReviewIssueKpiPair({ review, issue }: { review: ReactNode; issue: ReactNode }) {
  return (
    <div
      className={
        'col-span-2 flex min-w-0 gap-x-3 rounded-md bg-blue-950/55 px-3 py-2 ring-1 ring-blue-900/35 ring-inset ' +
        'md:!flex-[2_1_0%] md:border-l md:border-white/15 md:pl-3 md:lg:pl-6'
      }
    >
      <div className="min-w-0 flex-1">{review}</div>
      <div className="min-w-0 flex-1 border-l border-white/15 pl-3">{issue}</div>
    </div>
  )
}

export function Home() {
  const areas = areasIndex.areas
  const summariesByArea = Object.fromEntries(
    areasIndex.summaries.map((entry) => [entry.area, entry]),
  )

  const homeGroups = groupAreasByHomeTheme(areas, (a) => summariesByArea[a]?.osmProfile)

  const logoSrc = withSiteBasePath('/osm-grenzabgleich-logo-2025.svg')

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 text-left sm:px-6 lg:px-8">
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
          <div className="space-y-10">
            {homeGroups.map((group) => (
              <section key={group.id} id={HOME_GROUPS[group.id].anchor} className="scroll-mt-4">
                <h2 className="mb-1 text-base font-semibold text-slate-100">
                  {HOME_GROUPS[group.id].heading}
                </h2>
                {HOME_GROUPS[group.id].lead ? (
                  <p className="mb-3 text-sm text-slate-400">{HOME_GROUPS[group.id].lead}</p>
                ) : null}
                <ul className="space-y-4">
                  {group.areas.map((a) => {
                    const entry = summariesByArea[a]
                    const displayName = entry?.displayName ?? a
                    const matched = entry ? formatDeInteger(entry.matched) : EM_DASH
                    const officialOnly = entry ? formatDeInteger(entry.officialOnly) : EM_DASH
                    const unmatched = entry ? formatDeInteger(entry.unmatchedOsm) : EM_DASH
                    const staleOfficialKeyCount = entry?.staleOfficialKey ?? 0
                    const staleOfficialKey = entry
                      ? formatDeInteger(staleOfficialKeyCount)
                      : EM_DASH
                    const reviewsCountRaw = entry?.reviews ?? 0
                    const issuesCountRaw = entry?.issues ?? 0
                    const reviews = entry ? formatDeInteger(reviewsCountRaw) : EM_DASH
                    const issues = entry ? formatDeInteger(issuesCountRaw) : EM_DASH
                    return (
                      <li key={a}>
                        <Link
                          className="group block overflow-hidden rounded-lg border border-slate-700 bg-slate-900 p-4 transition-colors hover:border-slate-500 hover:bg-slate-800/60"
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
                                  <ReportCategoryLabel
                                    category="official_only"
                                    sourceKind={entry?.sourceKind}
                                  />
                                </ReportCategoryPill>
                              }
                              value={officialOnly}
                            />
                            <KpiCell
                              label={
                                <UnmatchedOsmStatPill>{de.home.unmatchedStat}</UnmatchedOsmStatPill>
                              }
                              value={unmatched}
                            />
                            {/* Outdated keys only exist for German Schlüssel; keep the slot so the grid stays aligned. */}
                            {group.id === 'administrative' ? (
                              <KpiCell
                                label={
                                  <span
                                    className={
                                      staleOfficialKeyCount > 0
                                        ? 'text-amber-200'
                                        : homeAmpelKpiZeroClass
                                    }
                                  >
                                    {de.home.staleOfficialKeyStat}
                                  </span>
                                }
                                value={staleOfficialKey}
                              />
                            ) : entry?.rowFlags?.[0] ? (
                              <KpiCell
                                label={
                                  <Abbr title={entry.rowFlags[0].hint}>
                                    {de.home.rowFlagStat(entry.rowFlags[0].label)}
                                  </Abbr>
                                }
                                value={formatDeInteger(entry.rowFlags[0].count)}
                              />
                            ) : (
                              <div aria-hidden="true" />
                            )}
                            <HomeReviewIssueKpiPair
                              review={
                                <KpiCell
                                  label={
                                    <span
                                      className={
                                        reviewsCountRaw > 0
                                          ? homeAmpelKpiActiveClass
                                          : homeAmpelKpiZeroClass
                                      }
                                    >
                                      {de.home.reviewsStat}
                                    </span>
                                  }
                                  value={
                                    <span
                                      className={
                                        reviewsCountRaw > 0
                                          ? homeAmpelKpiActiveClass
                                          : homeAmpelKpiZeroClass
                                      }
                                    >
                                      {reviews}
                                    </span>
                                  }
                                />
                              }
                              issue={
                                <KpiCell
                                  label={
                                    <span
                                      className={
                                        issuesCountRaw > 0
                                          ? homeAmpelKpiActiveClass
                                          : homeAmpelKpiZeroClass
                                      }
                                    >
                                      {de.home.issuesStat}
                                    </span>
                                  }
                                  value={
                                    <span
                                      className={
                                        issuesCountRaw > 0
                                          ? homeAmpelKpiActiveClass
                                          : homeAmpelKpiZeroClass
                                      }
                                    >
                                      {issues}
                                    </span>
                                  }
                                />
                              }
                            />
                          </KpiRow>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>

          <HomeLicenseSection licenseSummaries={areasIndex.licenseSummaries} areaOrder={areas} />
        </>
      )}
    </div>
  )
}

function licenseTupleParts(row: AreaLicenseSummary) {
  return {
    officialLicenseLabel: row.officialLicenseLabel,
    officialLicenseSourceUrl: row.officialLicenseSourceUrl,
    officialOsmCompatibility: row.officialOsmCompatibility,
    officialOsmCompatibilitySourceUrl: row.officialOsmCompatibilitySourceUrl,
    officialOsmCompatibilityComment: row.officialOsmCompatibilityComment,
  }
}

type HomeLicenseRowGroup =
  | { kind: 'single'; row: AreaLicenseSummary }
  | {
      kind: 'merged'
      mergeKey: string
      representative: AreaLicenseSummary
      sourceGroupKey: string
      members: AreaLicenseSummary[]
    }

function buildHomeLicenseRowGroups(rows: AreaLicenseSummary[]): HomeLicenseRowGroup[] {
  const firstIndexByMergeKey = new Map<string, number>()
  const membersByMergeKey = new Map<string, AreaLicenseSummary[]>()

  rows.forEach((row, index) => {
    // A licence per geometry is never merged with other rows.
    const mk = row.officialLicenseMixed
      ? `mixed\x1f${row.area}`
      : officialLicenseTableMergeKey(row.officialSourceGroupKey, licenseTupleParts(row))
    if (!firstIndexByMergeKey.has(mk)) {
      firstIndexByMergeKey.set(mk, index)
    }
    const list = membersByMergeKey.get(mk) ?? []
    list.push(row)
    membersByMergeKey.set(mk, list)
  })

  const orderedMergeKeys = [...firstIndexByMergeKey.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k)

  return orderedMergeKeys.map((mk) => {
    const members = membersByMergeKey.get(mk)!
    const representative = members[0]!
    if (members.length === 1) {
      return { kind: 'single', row: representative }
    }
    return {
      kind: 'merged',
      mergeKey: mk,
      representative,
      sourceGroupKey: representative.officialSourceGroupKey,
      members,
    }
  })
}

/** Muted inline links; sky + underline only on hover (matches emphasis of primary row links). */
const homeLicenseMergedDatasetLinkClass =
  'text-slate-500 decoration-sky-400/40 underline-offset-2 transition-colors hover:text-sky-400 hover:underline'

function HomeLicenseMergedDatasetLinks({ members }: { members: AreaLicenseSummary[] }) {
  return (
    <>
      {members.map((m, i) => (
        <span key={m.area}>
          {i > 0 ? ', ' : null}
          <Link
            to="/$areaId"
            params={{ areaId: m.area }}
            className={homeLicenseMergedDatasetLinkClass}
          >
            {m.displayName}
          </Link>
        </span>
      ))}
    </>
  )
}

/** Dataset with a licence per geometry: no single licence or evidence link, but a link to the overview. */
function HomeMixedLicenseCells({
  row,
  mixed,
}: {
  row: AreaLicenseSummary
  mixed: NonNullable<AreaLicenseSummary['officialLicenseMixed']>
}) {
  const g = de.provenance.licensePerGeometry
  return (
    <>
      <td className="px-3 py-2">{mixed.singleLicenseLabel ?? g.mixedLabel}</td>
      <td className="px-3 py-2">{compatibleShareLabel(mixed.compatibleCount, mixed.totalCount)}</td>
      <td className="px-3 py-2">
        <Link
          to="/$areaId"
          params={{ areaId: row.area }}
          hash="report-licence-section"
          className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
        >
          {g.homeOverviewLink}
        </Link>
      </td>
    </>
  )
}

function HomeLicenseCells({ row }: { row: AreaLicenseSummary }) {
  const p = de.provenance
  if (row.officialLicenseMixed) {
    return <HomeMixedLicenseCells row={row} mixed={row.officialLicenseMixed} />
  }
  return (
    <>
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
      <td className="px-3 py-2">{p.osmCompatibilityLabel[row.officialOsmCompatibility]}</td>
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
          <span className="mt-1 block text-slate-500">{row.officialOsmCompatibilityComment}</span>
        ) : null}
      </td>
    </>
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

  const groups = buildHomeLicenseRowGroups(rows)

  return (
    <section className="mt-8 rounded border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-400">
      <h2 className="mb-3 text-base font-semibold text-slate-100">
        {sourceText(undefined, 'licenseSectionHeading')}
      </h2>
      <div className="overflow-x-auto rounded border border-slate-700/70">
        <table className="min-w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-200">
            <tr>
              <th className="px-3 py-2">{de.provenance.licenseTableAreaColumn}</th>
              <th className="px-3 py-2">{p.licenseShortNameLabel}</th>
              <th className="px-3 py-2">{p.osmCompatibilityLabelTitle}</th>
              <th className="px-3 py-2">{p.osmCompatibilitySourceLabel}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              if (g.kind === 'single') {
                const row = g.row
                return (
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
                    <HomeLicenseCells row={row} />
                  </tr>
                )
              }
              const row = g.representative
              const isBkgBundle = g.sourceGroupKey === OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25
              const mergedSublineIntro = isBkgBundle
                ? p.licenseHomeBkgBundleSubline
                : p.licenseHomeSharedDownloadSourceSubline
              const nameCell = (
                <div>
                  <div className="font-medium text-slate-200">
                    {isBkgBundle
                      ? p.licenseHomeBkgBundleLabel
                      : p.licenseHomeSharedDownloadSourceLabel}
                  </div>
                  <div className="mt-1 text-xs leading-snug text-slate-500">
                    <span>
                      {mergedSublineIntro} {p.licenseHomeMergedDatasetListLead}{' '}
                    </span>
                    <HomeLicenseMergedDatasetLinks members={g.members} />
                  </div>
                </div>
              )
              return (
                <tr key={g.mergeKey} className="border-t border-slate-800/80">
                  <td className="px-3 py-2">{nameCell}</td>
                  <HomeLicenseCells row={row} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
