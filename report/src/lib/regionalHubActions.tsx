import { normalizeQid } from '../../../scripts/shared/regionalHubCompare.ts'
import type { RegionalHubMismatchFlag } from '../../../scripts/shared/regionalHubPayload.ts'
import { de } from '../i18n/de'
import { formatDeInteger } from './formatDe'
import { formatSnapshotDateLabelDe } from './formatSourceDownloadedAt'
import { buildJosmLoadRelationUrl, buildOpenStreetMapIdRelationEditUrl } from './osmEditorLinks'
import { wikidataItemUrl } from './regionalHubQuickStatements'

const t = de.regionalHub
const linkClass =
  'text-sm text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

export function regionalHubEditorHrefs(input: {
  relationId: string | undefined
  wdQid: string | undefined
  osmWikidata?: string
}): { id: string | null; josm: string | null; wikidata: string | null } {
  const rel = input.relationId ? Number(input.relationId) : Number.NaN
  const hasRelation = Number.isFinite(rel)
  const qid = input.wdQid?.trim() || (input.osmWikidata ? normalizeQid(input.osmWikidata) : '')
  const wikidataHref = /^Q\d+$/i.test(qid) ? wikidataItemUrl(qid) : null
  return {
    id: hasRelation ? buildOpenStreetMapIdRelationEditUrl({ relationId: rel }) : null,
    josm: hasRelation ? buildJosmLoadRelationUrl({ relationId: rel }) : null,
    wikidata: wikidataHref,
  }
}

function OsmTagHint({ tag }: { tag: string }) {
  return <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-200">{tag}</code>
}

export function RegionalHubEditActions(input: {
  issues: RegionalHubMismatchFlag[]
  relationId: string | undefined
  destatisPop: number | undefined
  destatisDate: string | undefined
  wdQid: string | undefined
  osmWikidata?: string
  ars12?: string
}) {
  const hrefs = regionalHubEditorHrefs(input)
  const osmWikidataHint =
    input.issues.includes('osm_wikidata') && input.wdQid ? `wikidata=${input.wdQid}` : null
  const osmPopHint =
    input.issues.includes('osm_population') && input.destatisPop != null && input.destatisDate
      ? {
          pop: `population=${input.destatisPop}`,
          date: `population:date=${input.destatisDate.slice(0, 10)}`,
        }
      : null
  const wdPopHint =
    input.issues.includes('wikidata_population') && input.destatisPop != null && input.destatisDate
      ? t.actionsWdPopHint(
          formatDeInteger(input.destatisPop),
          formatSnapshotDateLabelDe(input.destatisDate.slice(0, 10)) || input.destatisDate,
        )
      : null
  const wdP402Hint =
    input.issues.includes('wikidata_p402') && input.relationId
      ? t.actionsWdP402Hint(input.relationId)
      : null
  const osmQid = input.osmWikidata ? normalizeQid(input.osmWikidata) : ''
  const wdP1388Hint =
    !input.wdQid && /^Q\d+$/i.test(osmQid) && input.ars12
      ? t.actionsWdP1388Hint(osmQid, input.ars12)
      : null
  const hasOsmHints = Boolean(osmWikidataHint || osmPopHint)
  const hasWdHints = Boolean(wdPopHint || wdP402Hint || wdP1388Hint)
  const hasEditors = Boolean(hrefs.id || hrefs.josm || hrefs.wikidata)
  if (!hasOsmHints && !hasWdHints && !hasEditors) return null

  return (
    <>
      {hasEditors ? (
        <ul className="flex flex-col gap-2 text-sm">
          {hrefs.id ? (
            <li>
              <a href={hrefs.id} className={linkClass} target="_blank" rel="noreferrer noopener">
                {t.idEdit}
              </a>
            </li>
          ) : null}
          {hrefs.josm ? (
            <li>
              <a href={hrefs.josm} className={linkClass} target="_blank" rel="noreferrer noopener">
                {t.josmEdit}
              </a>
            </li>
          ) : null}
          {hrefs.wikidata ? (
            <li>
              <a
                href={hrefs.wikidata}
                className={linkClass}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t.wdEdit}
              </a>
            </li>
          ) : null}
        </ul>
      ) : null}
      {hasOsmHints ? (
        <div className="text-sm text-slate-400">
          <p>{t.actionsOsmHintsLead}</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {osmWikidataHint ? (
              <li>
                <OsmTagHint tag={osmWikidataHint} />
              </li>
            ) : null}
            {osmPopHint ? (
              <>
                <li>
                  <OsmTagHint tag={osmPopHint.pop} />
                </li>
                <li>
                  <OsmTagHint tag={osmPopHint.date} />
                </li>
              </>
            ) : null}
          </ul>
        </div>
      ) : null}
      {hasWdHints ? (
        <div className="text-sm text-slate-400">
          <p>{t.actionsWdHintsLead}</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {wdPopHint ? <li>{wdPopHint}</li> : null}
            {wdP402Hint ? <li>{wdP402Hint}</li> : null}
            {wdP1388Hint ? <li>{wdP1388Hint}</li> : null}
          </ul>
        </div>
      ) : null}
    </>
  )
}
