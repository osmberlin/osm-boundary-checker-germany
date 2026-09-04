import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { lookupSuccessorForExplorerKey } from '../../../scripts/shared/arsSuccessorTable.ts'
import { destatisAttributesForArs } from '../../../scripts/shared/germanKeyGemeindeSum.ts'
import { geometryAreaIdForArs } from '../../../scripts/shared/regionalArs.ts'
import {
  numericOsmRelationId,
  regionalHubIssues,
} from '../../../scripts/shared/regionalHubCompare.ts'
import type { RegionalHubMismatchFlag } from '../../../scripts/shared/regionalHubPayload.ts'
import { AlertNotice } from '../components/AlertNotice'
import { sharedButtonClass } from '../components/sharedButtonStyles'
import {
  arsSuccessorsQueryOptions,
  germanKeyLookupQueryOptions,
  overpassOsmTagsQueryOptions,
  regionalHubManifestQueryOptions,
  regionalHubOsmTagsQueryOptions,
  regionalHubWikidataQueryOptions,
} from '../data/load'
import { de } from '../i18n/de'
import { EM_DASH, formatDeInteger } from '../lib/formatDe'
import { formatSnapshotDateLabelDe } from '../lib/formatSourceDownloadedAt'
import { ags8FromArs12Digits, statistikportalGemeindeUrl } from '../lib/germanKeyExplorer'
import { resolveGemeindeNameByArs } from '../lib/germanKeyLookupBundle'
import { DEFAULT_OVERPASS_INTERPRETER_URL } from '../lib/overpassServers'
import { primaryCta, secondaryActions } from '../lib/regionalHubActions'
import {
  displayNameForArs,
  hubCompareInputForArs,
  newestPopulationSource,
} from '../lib/regionalHubDisplay'
import { wikidataItemUrl } from '../lib/regionalHubQuickStatements'

const t = de.regionalHub
const linkClass =
  'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

function formatDate(raw: string | undefined): string {
  if (!raw) return EM_DASH
  return formatSnapshotDateLabelDe(raw.slice(0, 10)) || raw
}

function verdictCopy(flag: RegionalHubMismatchFlag, mismatch: boolean): string {
  switch (flag) {
    case 'osm_wikidata':
      return mismatch ? t.verdictOsmWikidataMismatch : t.verdictOsmWikidataMissing
    case 'osm_population':
      return t.verdictOsmPopulation
    case 'wikidata_population':
      return t.verdictWikidataPopulation
    case 'wikidata_p402':
      return t.verdictWikidataP402
  }
}

export function RegionalHubDetail() {
  const { ars } = useParams({ from: '/regional/$ars' })
  const lookupQuery = useQuery(germanKeyLookupQueryOptions())
  const osmQuery = useQuery(regionalHubOsmTagsQueryOptions())
  const wdQuery = useQuery(regionalHubWikidataQueryOptions())
  const manifestQuery = useQuery(regionalHubManifestQueryOptions())
  const successorsQuery = useQuery(arsSuccessorsQueryOptions())
  const [liveEnabled, setLiveEnabled] = useState(false)

  const bundle = lookupQuery.data
  const osm = osmQuery.data?.byArs[ars]
  const wd = wdQuery.data?.byArs[ars]
  const destatis = bundle ? destatisAttributesForArs(bundle, ars) : null
  const compare = bundle ? hubCompareInputForArs({ bundle, ars12: ars, osm, wikidata: wd }) : null
  const issues = compare ? regionalHubIssues(compare) : []
  const primary = issues[0] ?? null
  const name = bundle ? displayNameForArs(bundle, ars) : null
  const latestInLatest = bundle ? Object.hasOwn(bundle.latest.gemeindenByArs, ars) : false
  const landName = bundle?.latest.bundeslaender[ars.slice(0, 2)]
  const kreisName = bundle?.latest.kreise[ars.slice(0, 5)]
  const ags8 = ags8FromArs12Digits(ars)
  const obsolete = bundle ? resolveGemeindeNameByArs(bundle, ars).obsolete : undefined
  const successor = successorsQuery.data
    ? lookupSuccessorForExplorerKey(successorsQuery.data, ars)
    : null
  const geometryArea = bundle ? geometryAreaIdForArs(ars, bundle.latest.gemeindenByArs) : null
  const newest = newestPopulationSource({
    destatisDate: bundle?.latest.populationDate,
    osmDate: osm?.populationDate,
    wdDate: wd?.date,
  })
  const relationId = numericOsmRelationId(osm?.osmId)
  const liveQuery = useQuery({
    ...overpassOsmTagsQueryOptions({
      id: Number(relationId ?? 0),
      interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
    }),
    enabled: liveEnabled && relationId != null,
  })

  const known =
    latestInLatest ||
    Boolean(bundle?.latest.bundeslaender[ars.slice(0, 2)] && ars.endsWith('0000000000')) ||
    Boolean(bundle?.latest.kreise[ars.slice(0, 5)] && ars.endsWith('0000000')) ||
    Boolean(name)

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 text-left sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-slate-700 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
          {name ?? t.detailNotFoundTitle}
        </h1>
        <p className="mt-2 font-mono text-sm text-slate-400">
          ARS {ars}
          {ags8 ? ` · AGS ${ags8}` : ''}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {[landName, kreisName].filter(Boolean).join(' › ')}
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link to="/tools/german-key" search={{ key: ars }} className={linkClass}>
            {t.decodeLink}
          </Link>
          {geometryArea ? (
            <Link
              to="/$areaId/feature/$featureKey"
              params={{ areaId: geometryArea, featureKey: ars }}
              className={linkClass}
            >
              {t.geometryLink}
            </Link>
          ) : null}
          {ags8 ? (
            <a
              href={statistikportalGemeindeUrl(ags8)}
              target="_blank"
              rel="noreferrer noopener"
              className={linkClass}
            >
              {t.statistikportalLink}
            </a>
          ) : null}
        </p>
      </header>

      {!known ? (
        <AlertNotice>
          <p>{t.unknownLead}</p>
        </AlertNotice>
      ) : obsolete && !latestInLatest ? (
        <AlertNotice>
          <p>{t.obsoleteLead(obsolete.year)}</p>
          {successor?.side === 'from' ? (
            <p className="mt-2">
              <Link to="/regional/$ars" params={{ ars: successor.row.toArs }} className={linkClass}>
                {t.successorCta}
              </Link>
            </p>
          ) : null}
        </AlertNotice>
      ) : (
        <div className="space-y-3">
          {destatis?.populationTotal === undefined ? (
            <div className="rounded-md border border-slate-600 bg-slate-800/40 p-4 text-sm text-slate-300">
              {t.noOfficialPopulation}
            </div>
          ) : null}
          {issues.length > 0 && primary != null ? (
            <AlertNotice>
              <ul className="list-inside list-disc space-y-1">
                {issues.map((flag) => (
                  <li key={flag}>
                    {verdictCopy(flag, flag === 'osm_wikidata' && Boolean(osm?.wikidata))}
                  </li>
                ))}
              </ul>
              {primaryCta({
                primary,
                osmWikidataMismatch: Boolean(osm?.wikidata),
                relationId,
                destatisPop: destatis?.populationTotal,
                destatisDate: bundle?.latest.populationDate,
                wdQid: wd?.qid,
                sourceUrl: bundle?.latest.sourcePublicUrl ?? '',
                retrievedIso: manifestQuery.data?.generatedAt ?? new Date().toISOString(),
              })}
            </AlertNotice>
          ) : destatis?.populationTotal !== undefined ? (
            <div className="rounded-md border border-slate-600 bg-slate-800/40 p-4 text-sm text-slate-300">
              {t.verdictOk}
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-8 overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full min-w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-900/80">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-400" />
              <th className="px-3 py-2 text-left font-medium text-slate-300">{t.colDestatis}</th>
              <th className="px-3 py-2 text-left font-medium text-slate-300">{t.colOsm}</th>
              <th className="px-3 py-2 text-left font-medium text-slate-300">{t.colWikidata}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-400">{t.rowPopulation}</th>
              <td className="px-3 py-2">
                {formatPop(destatis?.populationTotal)}
                {newest === 'destatis' ? <LatestChip /> : null}
              </td>
              <td className="px-3 py-2">
                {formatPop(compare?.osmPop)}
                {newest === 'osm' ? <LatestChip /> : null}
              </td>
              <td className="px-3 py-2">
                {formatPop(wd?.pop)}
                {newest === 'wikidata' ? <LatestChip /> : null}
              </td>
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-400">{t.rowDate}</th>
              <td className="px-3 py-2">{formatDate(bundle?.latest.populationDate)}</td>
              <td className="px-3 py-2">{formatDate(osm?.populationDate)}</td>
              <td className="px-3 py-2">{formatDate(wd?.date)}</td>
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-400">{t.rowArea}</th>
              <td className="px-3 py-2">
                {destatis?.areaKm2 != null
                  ? `${destatis.areaKm2.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} km²`
                  : EM_DASH}
              </td>
              <td className="px-3 py-2">{EM_DASH}</td>
              <td className="px-3 py-2">{EM_DASH}</td>
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-400">{t.rowWikidataId}</th>
              <td className="px-3 py-2">{EM_DASH}</td>
              <td className="px-3 py-2">{osm?.wikidata ?? EM_DASH}</td>
              <td className="px-3 py-2">
                {wd?.qid ? (
                  <a
                    href={wikidataItemUrl(wd.qid)}
                    className={linkClass}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {wd.qid}
                  </a>
                ) : (
                  EM_DASH
                )}
              </td>
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-400">{t.rowOsmRelation}</th>
              <td className="px-3 py-2">{EM_DASH}</td>
              <td className="px-3 py-2">{osm?.osmId ?? EM_DASH}</td>
              <td className="px-3 py-2">{wd?.osmRelationId ?? EM_DASH}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="text-base font-semibold text-slate-100">{t.actionsTitle}</h2>
        <p className="text-sm text-slate-400">{t.actionsLead}</p>
        <div className="flex flex-col gap-3">
          {secondaryActions({
            issues,
            primary,
            relationId,
            destatisPop: destatis?.populationTotal,
            destatisDate: bundle?.latest.populationDate,
            wdQid: wd?.qid,
            sourceUrl: bundle?.latest.sourcePublicUrl ?? '',
            retrievedIso: manifestQuery.data?.generatedAt ?? new Date().toISOString(),
            osmWikidata: osm?.wikidata,
          })}
        </div>
        {relationId ? (
          <details className="mt-4 rounded-lg border border-slate-800 p-3 text-sm text-slate-400">
            <summary className="cursor-pointer text-slate-200">{t.liveTagsTitle}</summary>
            <button
              type="button"
              className={`${sharedButtonClass} mt-3`}
              onClick={() => setLiveEnabled(true)}
            >
              {t.liveTagsButton}
            </button>
            {liveQuery.isFetching ? <p className="mt-2">{t.liveTagsLoading}</p> : null}
            {liveQuery.isError ? <p className="mt-2 text-amber-200">{t.liveTagsError}</p> : null}
            {liveQuery.data?.tags ? (
              <pre className="mt-2 overflow-auto text-xs text-slate-300">
                {JSON.stringify(liveQuery.data.tags, null, 2)}
              </pre>
            ) : null}
          </details>
        ) : null}
      </section>

      <p className="mt-10 text-xs text-slate-500">
        {t.provenanceLine(
          formatDate(bundle?.latest.populationDate),
          formatDate(osmQuery.data?.generatedAt),
          formatDate(wdQuery.data?.generatedAt),
        )}{' '}
        <Link to="/tools/regional/sources" className={linkClass}>
          {t.sourcesDebugLink}
        </Link>
      </p>
    </div>
  )
}

function LatestChip() {
  return (
    <span className="ml-2 rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-200">
      {t.latestChip}
    </span>
  )
}

function formatPop(n: number | undefined): string {
  return n == null ? EM_DASH : formatDeInteger(n)
}
