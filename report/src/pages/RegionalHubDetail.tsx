import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { lookupSuccessorForExplorerKey } from '../../../scripts/shared/arsSuccessorTable.ts'
import { destatisAttributesForArs } from '../../../scripts/shared/germanKeyGemeindeSum.ts'
import { geometryAreaIdForArs } from '../../../scripts/shared/regionalArs.ts'
import {
  NEUTRAL_HUB_CELL_TONES,
  numericOsmRelationId,
  normalizeQid,
  regionalHubCellTones,
  regionalHubIssues,
  type HubCellTone,
} from '../../../scripts/shared/regionalHubCompare.ts'
import type { RegionalHubMismatchFlag } from '../../../scripts/shared/regionalHubPayload.ts'
import { AlertNotice } from '../components/AlertNotice'
import {
  arsSuccessorsQueryOptions,
  germanKeyLookupQueryOptions,
  overpassOsmTagsQueryOptions,
  regionalHubOsmTagsQueryOptions,
  regionalHubWikidataQueryOptions,
} from '../data/load'
import { de } from '../i18n/de'
import { cn } from '../lib/cn'
import { formatDeInteger } from '../lib/formatDe'
import { formatSnapshotDateLabelDe } from '../lib/formatSourceDownloadedAt'
import { ags8FromArs12Digits, statistikportalGemeindeUrl } from '../lib/germanKeyExplorer'
import { resolveGemeindeNameByArs } from '../lib/germanKeyLookupBundle'
import { DEFAULT_OVERPASS_INTERPRETER_URL } from '../lib/overpassServers'
import { RegionalHubEditActions } from '../lib/regionalHubActions'
import {
  displayNameForArs,
  hubCompareInputForArs,
  newestPopulationSource,
  overlayLiveOsmTags,
} from '../lib/regionalHubDisplay'
import { wikidataItemUrl } from '../lib/regionalHubQuickStatements'

const t = de.regionalHub
const linkClass =
  'text-sm text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

function formatDate(raw: string | undefined): string | null {
  if (!raw) return null
  return formatSnapshotDateLabelDe(raw.slice(0, 10)) || raw
}

function hubTdClass(tone: HubCellTone): string {
  return cn('px-3 py-2', tone === 'ok' && 'bg-emerald-500/15', tone === 'bad' && 'bg-amber-500/10')
}

function hubTdTitle(tone: HubCellTone, title?: string): string | undefined {
  return (
    title ?? (tone === 'ok' ? t.cellToneOkTitle : tone === 'bad' ? t.cellToneBadTitle : undefined)
  )
}

function HubEmpty({
  kind,
  title,
  label,
}: {
  kind: 'na' | 'missing' | 'optional'
  title?: string
  label?: string
}) {
  if (kind === 'na') {
    return (
      <abbr className="cursor-help text-slate-600 no-underline" title={title ?? t.cellNaTitle}>
        {label ?? t.cellNa}
      </abbr>
    )
  }
  if (kind === 'optional') {
    return (
      <span className="text-slate-500" title={title ?? t.cellOptionalTitle}>
        {label ?? t.missingValue}
      </span>
    )
  }
  return (
    <span className="text-amber-200/90" title={title ?? t.cellMissingTitle}>
      {label ?? t.cellMissing}
    </span>
  )
}

function WikidataQidLink({ raw }: { raw: string }) {
  const qid = normalizeQid(raw)
  if (!/^Q\d+$/i.test(qid)) return raw
  return (
    <a href={wikidataItemUrl(qid)} className={linkClass} target="_blank" rel="noreferrer noopener">
      {qid}
    </a>
  )
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
  const successorsQuery = useQuery(arsSuccessorsQueryOptions())

  const bundle = lookupQuery.data
  const osmExtract = osmQuery.data?.byArs[ars]
  const wd = wdQuery.data?.byArs[ars]
  const destatis = bundle ? destatisAttributesForArs(bundle, ars) : null
  const relationId = numericOsmRelationId(osmExtract?.osmId)
  const liveQuery = useQuery({
    ...overpassOsmTagsQueryOptions({
      id: Number(relationId ?? 0),
      interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
    }),
    enabled: relationId != null,
  })
  const osm = overlayLiveOsmTags(
    osmExtract,
    liveQuery.isSuccess ? (liveQuery.data?.tags ?? {}) : undefined,
  )
  const compare = bundle ? hubCompareInputForArs({ bundle, ars12: ars, osm, wikidata: wd }) : null
  const issues = compare ? regionalHubIssues(compare) : []
  const tones = compare ? regionalHubCellTones(compare) : NEUTRAL_HUB_CELL_TONES
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
          {issues.length > 0 ? (
            <AlertNotice>
              <ul className="list-inside list-disc space-y-1">
                {issues.map((flag) => (
                  <li key={flag}>
                    {verdictCopy(flag, flag === 'osm_wikidata' && Boolean(osm?.wikidata))}
                  </li>
                ))}
              </ul>
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
              <td
                className={hubTdClass(tones.destatisPop)}
                title={hubTdTitle(
                  tones.destatisPop,
                  tones.destatisPop === 'ok' ? t.cellToneRefTitle : undefined,
                )}
              >
                {destatis?.populationTotal == null ? (
                  <HubEmpty kind="missing" />
                ) : (
                  <>
                    {formatDeInteger(destatis.populationTotal)}
                    {newest === 'destatis' ? <LatestChip /> : null}
                  </>
                )}
              </td>
              <td className={hubTdClass(tones.osmPop)} title={hubTdTitle(tones.osmPop)}>
                {compare?.osmPop == null ? (
                  <HubEmpty kind="missing" />
                ) : (
                  <>
                    {formatDeInteger(compare.osmPop)}
                    {newest === 'osm' ? <LatestChip /> : null}
                  </>
                )}
              </td>
              <td className={hubTdClass(tones.wdPop)} title={hubTdTitle(tones.wdPop)}>
                {wd?.pop == null ? (
                  <HubEmpty kind="missing" />
                ) : (
                  <>
                    {formatDeInteger(wd.pop)}
                    {newest === 'wikidata' ? <LatestChip /> : null}
                  </>
                )}
              </td>
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-400">{t.rowDate}</th>
              <td
                className={hubTdClass(tones.destatisDate)}
                title={hubTdTitle(
                  tones.destatisDate,
                  tones.destatisDate === 'ok' ? t.cellToneRefTitle : undefined,
                )}
              >
                {formatDate(bundle?.latest.populationDate) ?? <HubEmpty kind="missing" />}
              </td>
              <td className={hubTdClass(tones.osmDate)} title={hubTdTitle(tones.osmDate)}>
                {formatDate(osm?.populationDate) ?? <HubEmpty kind="optional" />}
              </td>
              <td className={hubTdClass(tones.wdDate)} title={hubTdTitle(tones.wdDate)}>
                {formatDate(wd?.date) ?? <HubEmpty kind="missing" />}
              </td>
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-400">{t.rowArea}</th>
              <td className="px-3 py-2">
                {destatis?.areaKm2 != null ? (
                  `${destatis.areaKm2.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} km²`
                ) : (
                  <HubEmpty kind="missing" />
                )}
              </td>
              <td className="px-3 py-2">
                <HubEmpty kind="na" title={t.cellNaOsmArea} />
              </td>
              <td className="px-3 py-2">
                <HubEmpty kind="na" title={t.cellNaWdArea} />
              </td>
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-400">{t.rowWikidataId}</th>
              <td className="px-3 py-2">
                <HubEmpty kind="na" title={t.cellNaDestatisQid} />
              </td>
              <td className={hubTdClass(tones.osmWikidata)} title={hubTdTitle(tones.osmWikidata)}>
                {osm?.wikidata ? (
                  <WikidataQidLink raw={osm.wikidata} />
                ) : (
                  <HubEmpty kind="missing" />
                )}
              </td>
              <td className={hubTdClass(tones.wdQid)} title={hubTdTitle(tones.wdQid)}>
                {wd?.qid ? (
                  <WikidataQidLink raw={wd.qid} />
                ) : osm?.wikidata ? (
                  <HubEmpty
                    kind="missing"
                    label={t.cellWdNoP1388}
                    title={t.cellWdNoP1388Title(normalizeQid(osm.wikidata))}
                  />
                ) : (
                  <HubEmpty kind="missing" />
                )}
              </td>
            </tr>
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-400">{t.rowOsmRelation}</th>
              <td className="px-3 py-2">
                <HubEmpty kind="na" title={t.cellNaDestatisOsm} />
              </td>
              <td className={hubTdClass(tones.osmRelation)} title={hubTdTitle(tones.osmRelation)}>
                {osm?.osmId ?? <HubEmpty kind="missing" />}
              </td>
              <td className={hubTdClass(tones.wdP402)} title={hubTdTitle(tones.wdP402)}>
                {wd?.osmRelationId ?? <HubEmpty kind="optional" />}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="space-y-1 border-t border-slate-800 px-3 py-2 text-xs text-slate-500">
          <p>{t.tableLegend}</p>
          <p>{t.tableToneLegend}</p>
        </div>
      </div>

      <section className="mt-10 space-y-3">
        <h2 className="text-base font-semibold text-slate-100">{t.actionsTitle}</h2>
        <p className="text-sm text-slate-400">{t.actionsLead}</p>
        <div className="flex flex-col gap-3">
          <RegionalHubEditActions
            issues={issues}
            relationId={relationId}
            destatisPop={destatis?.populationTotal}
            destatisDate={bundle?.latest.populationDate}
            wdQid={wd?.qid}
            osmWikidata={osm?.wikidata}
            ars12={ars}
          />
        </div>
        {relationId ? (
          <details className="text-sm text-slate-400">
            <summary className={`cursor-pointer font-normal ${linkClass}`}>
              {t.liveTagsTitle}
            </summary>
            <button
              type="button"
              className={`mt-2 ${linkClass}`}
              onClick={() => {
                void liveQuery.refetch()
              }}
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
          formatDate(bundle?.latest.populationDate) ?? t.provenanceUnknown,
          formatDate(osmQuery.data?.generatedAt) ?? t.provenanceUnknown,
          formatDate(wdQuery.data?.generatedAt) ?? t.provenanceUnknown,
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
