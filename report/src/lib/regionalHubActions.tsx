import type { RegionalHubMismatchFlag } from '../../../scripts/shared/regionalHubPayload.ts'
import { sharedButtonClass } from '../components/sharedButtonStyles'
import { de } from '../i18n/de'
import { buildJosmLoadRelationUrl, buildOpenStreetMapIdRelationEditUrl } from './osmEditorLinks'
import {
  destatisPopulationQuickStatementsUrl,
  osmRelationP402QuickStatementsUrl,
  wikidataItemUrl,
} from './regionalHubQuickStatements'

const t = de.regionalHub
const linkClass =
  'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

type RegionalHubIssueHrefInput = {
  relationId: string | undefined
  destatisPop: number | undefined
  destatisDate: string | undefined
  wdQid: string | undefined
  sourceUrl: string
  retrievedIso: string
}

export function hrefForIssue(
  flag: RegionalHubMismatchFlag,
  input: RegionalHubIssueHrefInput,
): string | null {
  const rel = input.relationId ? Number(input.relationId) : null
  if (flag === 'osm_wikidata' || flag === 'osm_population') {
    if (rel == null) return null
    const addTags: Record<string, string> = {}
    if (flag === 'osm_wikidata' && input.wdQid) addTags.wikidata = input.wdQid
    if (flag === 'osm_population' && input.destatisPop != null && input.destatisDate) {
      addTags.population = String(input.destatisPop)
      addTags['population:date'] = input.destatisDate.slice(0, 10)
    }
    return buildOpenStreetMapIdRelationEditUrl({ relationId: rel, addTags })
  }
  if (
    flag === 'wikidata_population' &&
    input.wdQid &&
    input.destatisPop != null &&
    input.destatisDate
  ) {
    return destatisPopulationQuickStatementsUrl({
      qid: input.wdQid,
      population: input.destatisPop,
      pointInTimeIso: input.destatisDate,
      sourceUrl: input.sourceUrl,
      retrievedIso: input.retrievedIso,
    })
  }
  if (flag === 'wikidata_p402' && input.wdQid && input.relationId) {
    return osmRelationP402QuickStatementsUrl(input.wdQid, input.relationId)
  }
  return input.wdQid
    ? wikidataItemUrl(input.wdQid, flag === 'wikidata_p402' ? 'P402' : 'P1082')
    : null
}

export function primaryCta(input: {
  primary: RegionalHubMismatchFlag
  osmWikidataMismatch: boolean
  relationId: string | undefined
  destatisPop: number | undefined
  destatisDate: string | undefined
  wdQid: string | undefined
  sourceUrl: string
  retrievedIso: string
}) {
  const label =
    input.primary === 'osm_wikidata' && input.osmWikidataMismatch
      ? t.ctaOsmWikidataCheck
      : input.primary === 'osm_wikidata'
        ? t.ctaOsmWikidata
        : input.primary === 'osm_population'
          ? t.ctaOsmPopulation
          : input.primary === 'wikidata_population'
            ? t.ctaWikidataPopulation
            : t.ctaWikidataP402
  const href = hrefForIssue(input.primary, input)
  if (!href) return null
  return (
    <p className="mt-3">
      <a href={href} className={sharedButtonClass} target="_blank" rel="noreferrer noopener">
        {label}
      </a>
    </p>
  )
}

export function secondaryActions(input: {
  issues: RegionalHubMismatchFlag[]
  primary: RegionalHubMismatchFlag | null
  relationId: string | undefined
  destatisPop: number | undefined
  destatisDate: string | undefined
  wdQid: string | undefined
  sourceUrl: string
  retrievedIso: string
  osmWikidata: string | undefined
}) {
  const secondary = input.issues.filter((flag) => flag !== input.primary)
  const rel = input.relationId ? Number(input.relationId) : null
  return (
    <>
      {rel != null ? (
        <p className="text-xs text-slate-500">
          {input.wdQid ? t.helperOsmWikidata(input.wdQid) : null}
          {input.destatisPop != null && input.destatisDate
            ? ` ${t.helperOsmPopulation(String(input.destatisPop), input.destatisDate.slice(0, 10))}`
            : null}
        </p>
      ) : null}
      {secondary.map((flag) => {
        const href = hrefForIssue(flag, input)
        if (!href) return null
        const label =
          flag === 'osm_wikidata'
            ? input.osmWikidata
              ? t.ctaOsmWikidataCheck
              : t.ctaOsmWikidata
            : flag === 'osm_population'
              ? t.ctaOsmPopulation
              : flag === 'wikidata_population'
                ? t.ctaWikidataPopulation
                : t.ctaWikidataP402
        return (
          <a
            key={flag}
            href={href}
            className="text-sm text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
            target="_blank"
            rel="noreferrer noopener"
          >
            {label}
          </a>
        )
      })}
      {input.primary === 'wikidata_population' || input.issues.includes('wikidata_population') ? (
        <p className="text-xs text-slate-500">{t.qsReviewHint}</p>
      ) : null}
      {rel != null ? (
        <a
          href={buildJosmLoadRelationUrl({ relationId: rel })}
          className="text-sm text-slate-400 underline decoration-slate-700 underline-offset-2"
        >
          {t.josmEdit}
        </a>
      ) : null}
      {input.wdQid ? (
        <a
          href={wikidataItemUrl(input.wdQid)}
          className={linkClass}
          target="_blank"
          rel="noreferrer"
        >
          {t.qsOpenItem}
        </a>
      ) : null}
    </>
  )
}
