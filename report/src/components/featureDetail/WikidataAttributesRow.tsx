import { QuestionMarkCircleIcon } from '@heroicons/react/20/solid'
import type { SourceKind } from '../../../../scripts/shared/sourceKind.ts'
import type {
  WikidataShard,
  WikidataShardItem,
} from '../../../../scripts/shared/wikidataProtectedAreasPayload.ts'
import { de } from '../../i18n/de'
import { sourceText } from '../../i18n/sourceVocabulary'
import { formatDeFixed } from '../../lib/formatDe'
import {
  wikidataFieldRows,
  type WikidataFieldId,
  type WikidataFieldRow,
} from '../../lib/wikidataFields'
import { ProvenanceGridRow } from '../ProvenanceGridRow'
import { CompareMarker } from '../ui/CompareMarker'
import { MarkedValue } from '../ui/MarkedValue'

const t = de.feature.wikidata
const LINK_CLASS =
  'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'
const CODE_CLASS =
  'inline-block rounded bg-slate-800/80 px-1 py-0.5 font-mono text-[11px] text-slate-100'

const wikidataUrl = (qid: string) => `https://www.wikidata.org/wiki/${qid}`

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={`${LINK_CLASS} break-all`}>
      {children}
    </a>
  )
}

function FieldValue({ field, item }: { field: WikidataFieldId; item: WikidataShardItem }) {
  switch (field) {
    case 'website':
      return (item.website ?? []).map((url) => (
        <ExternalLink key={url} href={url}>
          {url}
        </ExternalLink>
      ))
    case 'commons':
      return item.commons ? (
        <ExternalLink
          href={`https://commons.wikimedia.org/wiki/Category:${encodeURIComponent(item.commons.replaceAll(' ', '_'))}`}
        >
          {item.commons}
        </ExternalLink>
      ) : null
    case 'operator':
      return (item.operator ?? []).map((operator) => (
        <ExternalLink key={operator.qid} href={wikidataUrl(operator.qid)}>
          {operator.label ?? operator.qid}
        </ExternalLink>
      ))
    case 'area':
      return item.areaHa === undefined ? null : (
        <span>{`${formatDeFixed(item.areaHa, 2)} ${t.areaUnit}`}</span>
      )
    case 'label':
      return item.label ? <span>{item.label}</span> : null
    case 'wdpa':
    case 'osmRelation':
      return <span>{(item[field] ?? []).join('; ')}</span>
  }
}

function markerTooltip(row: WikidataFieldRow, dataHeading: string) {
  const pairs = row.compared
    .map(({ source, key, value, label }) => {
      const pair = key === '' ? value : `${key}=${value}`
      return `${label ?? (source === 'official' ? dataHeading : 'OSM')}: ${pair}`
    })
    .join(' · ')
  return `${row.status === 'equal' ? t.equalTooltip : t.differentTooltip}: ${pairs}`
}

function ItemFields({
  item,
  rows,
  dataHeading,
}: {
  item: WikidataShardItem
  rows: WikidataFieldRow[]
  dataHeading: string
}) {
  return (
    <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {rows.map((row) => {
        const empty = row.values.length === 0
        return (
          <div key={row.id} className="contents">
            <dt className="text-xs break-words text-slate-400">
              {t.properties[row.id] ? (
                <span className="font-mono">{t.properties[row.id]} </span>
              ) : null}
              {t.fields[row.id]}
            </dt>
            <dd className="min-w-0 break-words text-slate-100">
              {empty ? (
                row.suggestion ? (
                  <span className="flex items-start gap-1.5 text-xs text-slate-300">
                    <QuestionMarkCircleIcon
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-orange-400"
                    />
                    <span>
                      {t.missingAdd} <code className={CODE_CLASS}>{row.suggestion}</code>
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-500 italic">{t.missing}</span>
                )
              ) : (
                <MarkedValue
                  markers={
                    row.status !== 'none' ? (
                      <CompareMarker
                        equal={row.status === 'equal'}
                        tooltip={markerTooltip(row, dataHeading)}
                      />
                    ) : null
                  }
                >
                  <span className="flex min-w-0 flex-wrap gap-x-2">
                    <FieldValue field={row.id} item={item} />
                  </span>
                </MarkedValue>
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

function WikidataItem({
  item,
  caption,
  rows,
  dataHeading,
}: {
  item: WikidataShardItem
  caption: string | null
  rows: WikidataFieldRow[]
  dataHeading: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {caption ? <span className="text-xs text-slate-400">{caption}</span> : null}
        <ExternalLink href={wikidataUrl(item.qid)}>
          <span className="font-mono text-xs">{item.qid}</span>
        </ExternalLink>
        <ExternalLink href={wikidataUrl(item.qid)}>{t.edit}</ExternalLink>
      </div>
      {item.notFound ? (
        <p className="text-sm text-slate-400">{t.notFound}</p>
      ) : (
        <ItemFields item={item} rows={rows} dataHeading={dataHeading} />
      )}
    </div>
  )
}

/**
 * "Wikidata" block of the attribute view: the item(s) that the official record and the OSM object
 * name, each field next to what they say, and a hint where Wikidata lacks a value they have.
 */
export function WikidataAttributesRow({
  wikidata,
  official,
  osm,
  osmRelationId,
  areaM2,
  sourceKind,
}: {
  wikidata: WikidataShard
  official: Record<string, unknown>
  osm: Record<string, unknown>
  osmRelationId: string
  /** Areas of the official and the matched OSM geometry (matched rows); `null` when unknown. */
  areaM2: { official: number; osm: number } | null
  sourceKind: SourceKind | undefined
}) {
  const dataHeading = sourceText(sourceKind, 'dataHeading')
  const items = [
    { item: wikidata.official, caption: t.viaOfficial(dataHeading) },
    { item: wikidata.osm, caption: t.viaOsm },
  ].flatMap(({ item, caption }) => (item ? [{ item, caption }] : []))
  const context = {
    official,
    osm,
    osmRelationId,
    areaHa: areaM2 ? { official: areaM2.official / 10_000, osm: areaM2.osm / 10_000 } : undefined,
    officialGeometryLabel: sourceText(sourceKind, 'geometryLabel'),
  }
  return (
    <ProvenanceGridRow
      asDl
      surfaceClassName="bg-teal-950/18"
      leftColumnClassName="flex flex-col gap-1"
      rightColumnClassName="mt-2 space-y-5"
      title={<h3 className="text-sm/6 font-medium text-slate-200">{t.title}</h3>}
      titleAside={<p className="text-xs leading-normal text-slate-400">{t.lead}</p>}
    >
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">{t.none}</p>
      ) : (
        items.map(({ item, caption }) => (
          <WikidataItem
            key={item.qid}
            item={item}
            caption={items.length > 1 ? caption : null}
            rows={wikidataFieldRows(item, context)}
            dataHeading={dataHeading}
          />
        ))
      )}
    </ProvenanceGridRow>
  )
}
