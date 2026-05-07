import type { ReactElement } from 'react'
import { Fragment } from 'react'
import type { OsmMatchCriteriaSummary } from '../../../scripts/shared/comparisonPayload.ts'
import { buildResolvedOsmSourceSide } from '../../../scripts/shared/osmGermanyProvenance.ts'
import { areasIndex } from '../data/areasIndex'
import { de } from '../i18n/de'
import { EM_DASH } from '../lib/formatDe'
import {
  formatFreshnessDisplayDe,
  formatIsoTimestampToDateOnlyDe,
} from '../lib/formatSourceDownloadedAt'
import { germanKeyExplorerLinkValueOrNull } from '../lib/germanKeyExplorer'
import { optionalSourceStatLines, sourceStatLines } from '../lib/reportFreshnessLines'
import type { ComparisonFilterConfigSummary, ComparisonForReport, ReportRow } from '../types/report'
import { GermanKeyVerifyLink } from './GermanKeyVerifyLink'

export type ReportDataProvenanceFooterProps = {
  data: ComparisonForReport
  row?: ReportRow
  className?: string
  hideFreshnessSection?: boolean
}

function hostFromHref(url: string): string {
  const host = new URL(url).host.trim().toLowerCase()
  return host.startsWith('www.') ? host.slice(4) : host
}

function datasetFromDownloadUrl(url: string): string | undefined {
  const candidate = new URL(url).pathname.split('/').filter(Boolean).at(-1)?.trim()
  return candidate && candidate.length > 0 ? candidate : undefined
}

function deriveDownloadDetails(
  url: string,
  dataset: string | undefined,
  layer: string | undefined,
): string[] {
  const p = de.provenance
  const details: string[] = []
  const parsed = new URL(url)
  const params = parsed.searchParams
  const service = params.get('service')?.trim().toUpperCase()
  const request = params.get('request')?.trim().toUpperCase()
  const typeNames = params.get('typeNames')?.trim()
  const outputFormat = params.get('outputFormat')?.trim().toLowerCase()
  const pathLc = parsed.pathname.toLowerCase()
  const isWfs =
    service === 'WFS' || request === 'GETFEATURE' || Boolean(typeNames) || pathLc.includes('/wfs')
  if (isWfs) details.push(p.directDownloadDetails.wfs)
  if (outputFormat?.includes('json')) details.push(p.directDownloadDetails.geojson)
  if (outputFormat?.includes('gml')) details.push(p.directDownloadDetails.gml)
  if (pathLc.endsWith('.pbf') || (dataset ?? '').toLowerCase().includes('.osm.pbf')) {
    details.push(p.directDownloadDetails.pbf)
  }

  if (dataset?.trim()) details.push(dataset.trim())
  if (layer?.trim()) details.push(`layer=${layer.trim()}`)
  return Array.from(new Set(details))
}

function DataLinkItem({ label, url, details }: { label: string; url: string; details?: string[] }) {
  return (
    <li>
      <a
        className="text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        {label}: {hostFromHref(url)}
      </a>
      {details?.length ? <span className="text-slate-500"> ({details.join(', ')})</span> : null}
    </li>
  )
}

function SourceLinksList({
  sourcePublicUrl,
  sourceDownloadUrl,
  sourceDownloadDetails,
}: {
  sourcePublicUrl: string | undefined
  sourceDownloadUrl: string | undefined
  sourceDownloadDetails: string[]
}) {
  const p = de.provenance
  if (!sourcePublicUrl && !sourceDownloadUrl) {
    return <li className="text-slate-500">{p.noSourceData}</li>
  }
  return (
    <>
      {sourcePublicUrl ? <DataLinkItem label={p.dataSourceLabel} url={sourcePublicUrl} /> : null}
      {sourceDownloadUrl ? (
        <DataLinkItem
          label={p.directDownloadLabel}
          url={sourceDownloadUrl}
          details={sourceDownloadDetails}
        />
      ) : null}
    </>
  )
}

function FilterItem({ code, description }: { code: string; description: string }) {
  return (
    <li>
      <span className="block">
        <code className="break-all text-slate-500">{code}</code>
      </span>
      <span className="block">{description}</span>
    </li>
  )
}

function matchCriteriaLine(mc: OsmMatchCriteriaSummary): { code: string; description: string } {
  const p = de.provenance
  return mc.kind === 'property'
    ? { code: 'osmMatchCriteria=property', description: p.compareMatchCriteriaProperty }
    : {
        code: `osmMatchCriteria=relation_id`,
        description: p.compareMatchCriteriaRelations(mc.relationIds.join(', ')),
      }
}

function compareMappingItems(
  data: ComparisonForReport,
  filter: ComparisonFilterConfigSummary | undefined,
) {
  const p = de.provenance
  const summary = areasIndex.summaries.find((x) => x.area === data.area)
  const osmMatchProp = filter?.osmMatchProperty?.trim() || summary?.osmMatchProperty
  const preset = data.idNormalizationPreset
  const mc = data.osmMatchCriteria

  const presetLabels = {
    ...de.germanKeyExplorer.presets,
    ...de.provenance.idNormalizationPresetExtraLabels,
  }
  const items: ReactElement[] = []

  if (filter?.officialMatchProperty?.trim()) {
    const key = filter.officialMatchProperty.trim()
    items.push(
      <FilterItem
        key="compare-official"
        code={`officialMatchProperty=${key}`}
        description={p.filterDescriptions.officialMatchProperty(key)}
      />,
    )
  }

  if (osmMatchProp) {
    items.push(
      <FilterItem
        key="compare-osm-tag"
        code={`osmMatchTag=${osmMatchProp}`}
        description={p.compareOsmMatchTag(osmMatchProp)}
      />,
    )
  }

  if (preset) {
    const labelDe =
      preset in presetLabels ? presetLabels[preset as keyof typeof presetLabels] : preset
    items.push(
      <FilterItem
        key="compare-preset"
        code={`idNormalization.preset=${preset}`}
        description={p.compareIdNormalization(preset, labelDe)}
      />,
    )
  }

  if (mc) {
    const { code: mcCode, description: mcDesc } = matchCriteriaLine(mc)
    items.push(<FilterItem key="compare-match-criteria" code={mcCode} description={mcDesc} />)
  }

  return items
}

function compareFilterItems(
  data: ComparisonForReport,
  filter: ComparisonFilterConfigSummary | undefined,
) {
  const p = de.provenance
  const summary = areasIndex.summaries.find((x) => x.area === data.area)
  const adminLevels = filter?.adminLevels?.length ? filter.adminLevels : summary?.osmAdminLevels
  const boundaryValue = data.overpassBoundaryTag ?? 'administrative'
  const osmItems: ReactElement[] = []
  const officialItems: ReactElement[] = []

  osmItems.push(
    <FilterItem
      key="compare-boundary"
      code={`boundary=${boundaryValue}`}
      description={p.compareBoundaryTag(boundaryValue)}
    />,
  )

  if (adminLevels?.length) {
    osmItems.push(
      <FilterItem
        key="compare-admin"
        code={`admin_level=[${adminLevels.join(', ')}]`}
        description={p.compareAdminLevels(adminLevels.join(', '))}
      />,
    )
  }

  if (filter?.bboxFilter) {
    officialItems.push(
      <FilterItem
        key="compare-bbox"
        code={`bboxFilter=${filter.bboxFilter}`}
        description={p.filterDescriptions.bboxFilter[filter.bboxFilter]}
      />,
    )
    if (filter.bboxFilter === 'official_bbox_overlap' && filter.bboxBufferDegrees !== undefined) {
      officialItems.push(
        <FilterItem
          key="compare-bbox-buffer"
          code={`bboxBufferDegrees=${filter.bboxBufferDegrees}`}
          description={p.filterDescriptions.bboxBufferDegrees(filter.bboxBufferDegrees)}
        />,
      )
    }
  }

  if (filter?.osmScopeFilter) {
    osmItems.push(
      <FilterItem
        key="compare-osm-scope"
        code={`osmScopeFilter=${filter.osmScopeFilter}`}
        description={p.filterDescriptions.osmScopeFilter[filter.osmScopeFilter]}
      />,
    )
  }

  if ((filter?.ignoreRelationIds?.length ?? 0) > 0) {
    const ids = filter!.ignoreRelationIds!.join(',')
    osmItems.push(
      <FilterItem
        key="compare-ignore-rel"
        code={`ignoreRelationIds=${ids}`}
        description={p.filterDescriptions.ignoreRelationIds}
      />,
    )
  }

  if (filter?.officialExtractLayer?.trim()) {
    officialItems.push(
      <FilterItem
        key="compare-extract-layer"
        code={`officialExtractLayer=${filter.officialExtractLayer.trim()}`}
        description={p.compareOfficialExtractLayer}
      />,
    )
  }

  return { osmItems, officialItems }
}

/** Three `dl` rows: compare rules, OSM filter, official filter — headings in `dt` like source rows. */
function compareProvenanceDlRows(
  data: ComparisonForReport,
  row: ReportRow | undefined,
  filter: ComparisonFilterConfigSummary | undefined,
) {
  const p = de.provenance
  const mappingItems = compareMappingItems(data, filter)
  const { osmItems, officialItems } = compareFilterItems(data, filter)
  const explorerKey = row == null ? null : germanKeyExplorerLinkValueOrNull(row.canonicalMatchKey)
  const compareDataItems =
    row == null
      ? []
      : [
          {
            key: 'compare-data-osm',
            code:
              row.category === 'official_only'
                ? p.compareDataMissing
                : row.canonicalMatchKey || EM_DASH,
            label: p.compareDataOsmLabel,
            showExplorerLink: row.category !== 'official_only' && explorerKey != null,
          },
          {
            key: 'compare-data-official',
            code:
              row.category === 'unmatched_osm'
                ? p.compareDataMissing
                : row.canonicalMatchKey || EM_DASH,
            label: p.compareDataOfficialLabel,
            showExplorerLink: row.category !== 'unmatched_osm' && explorerKey != null,
          },
        ]

  if (mappingItems.length === 0 && osmItems.length === 0 && officialItems.length === 0) {
    return (
      <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
        <dt className="sr-only">{p.compareHeading}</dt>
        <dd className="mt-3 md:col-span-2 md:mt-0">
          <p className="text-slate-500" role="note">
            {p.compareNoCompareConfig}
          </p>
        </dd>
      </div>
    )
  }

  return (
    <Fragment>
      {compareDataItems.length > 0 ? (
        <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
          <dt>
            <h3 className="text-sm/6 font-medium text-slate-200">{p.compareDataHeading}</h3>
          </dt>
          <dd className="mt-3 md:col-span-2 md:mt-0">
            <p className="text-xs text-slate-400">{p.compareDataLead}</p>
            <ul className="mt-3 list-disc space-y-3 pl-5 text-slate-300 marker:text-slate-500">
              {compareDataItems.map((item) => (
                <li key={item.key}>
                  <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2">
                      <code
                        className={
                          item.code === p.compareDataMissing
                            ? 'font-medium break-all text-rose-300'
                            : 'break-all text-slate-500'
                        }
                      >
                        {item.code}
                      </code>
                      <span>{item.label}</span>
                    </span>
                    {row != null && item.showExplorerLink && explorerKey != null ? (
                      <GermanKeyVerifyLink
                        keyValue={explorerKey}
                        className="shrink-0 text-sm font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}

      <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
        <dt>
          <h3 className="text-sm/6 font-medium text-slate-200">{p.compareMappingHeading}</h3>
        </dt>
        <dd className="mt-3 md:col-span-2 md:mt-0">
          <p className="text-xs text-slate-400">
            {p.compareMappingLeadWithMetricsCrs(data.metricsCrs)}
          </p>
          {mappingItems.length > 0 ? (
            <ul className="mt-3 list-disc space-y-3 pl-5 text-slate-300 marker:text-slate-500">
              {mappingItems}
            </ul>
          ) : (
            <p className="mt-2 text-slate-500">{p.compareMappingEmpty}</p>
          )}
        </dd>
      </div>

      <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
        <dt>
          <h3 className="text-sm/6 font-medium text-slate-200">{p.compareOsmFilterHeading}</h3>
        </dt>
        <dd className="mt-3 md:col-span-2 md:mt-0">
          <p className="text-xs text-slate-400">{p.compareFilterLead}</p>
          {osmItems.length > 0 ? (
            <ul className="mt-3 list-disc space-y-3 pl-5 text-slate-300 marker:text-slate-500">
              {osmItems}
            </ul>
          ) : (
            <p className="mt-2 text-slate-500">{p.compareFilterEmpty}</p>
          )}
        </dd>
      </div>

      <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
        <dt>
          <h3 className="text-sm/6 font-medium text-slate-200">{p.compareOfficialFilterHeading}</h3>
        </dt>
        <dd className="mt-3 md:col-span-2 md:mt-0">
          {officialItems.length > 0 ? (
            <ul className="list-disc space-y-3 pl-5 text-slate-300 marker:text-slate-500">
              {officialItems}
            </ul>
          ) : (
            <p className="mt-2 text-slate-500">{p.compareFilterEmpty}</p>
          )}
        </dd>
      </div>
    </Fragment>
  )
}

function DateLine({ label, abs, rel }: { label: string; abs: string; rel: string }) {
  const bothDash = abs === EM_DASH && rel === EM_DASH
  return (
    <p className="text-slate-300">
      <span className="font-medium text-slate-200">{label}:</span>{' '}
      {bothDash ? (
        EM_DASH
      ) : (
        <>
          <span className="tabular-nums">{abs}</span>
          {rel !== EM_DASH ? <span className="text-slate-500"> ({rel})</span> : null}
        </>
      )}
    </p>
  )
}

export function ReportDataProvenanceFooter({
  data,
  row,
  className = '',
  hideFreshnessSection = false,
}: ReportDataProvenanceFooterProps) {
  const p = de.provenance
  const { official } = data.sourceMetadata
  const osm = buildResolvedOsmSourceSide(data.sourceMetadata.osm)
  const filter = data.filterConfigSummary

  const reportFresh = formatFreshnessDisplayDe(data.generatedAt.trim())
  const officialGeomFresh = sourceStatLines(official.downloadedAt, true)
  const officialStandRaw = official.sourceUpdatedAt?.trim()
  const officialStandAbs =
    officialStandRaw && officialStandRaw !== ''
      ? formatIsoTimestampToDateOnlyDe(officialStandRaw)
      : EM_DASH
  const officialVerifiedFresh = optionalSourceStatLines(official.sourceUpdatedAtVerifiedAt?.trim())
  const officialPublishedRaw = official.sourcePublishedAt?.trim()
  const officialPublishedFresh =
    officialPublishedRaw && officialPublishedRaw !== '' && officialPublishedRaw !== officialStandRaw
      ? optionalSourceStatLines(officialPublishedRaw)
      : null
  const osmFresh = sourceStatLines(osm.downloadedAt, true)

  const officialDownloadDetails = deriveDownloadDetails(
    official.sourceDownloadUrl,
    official.dataset,
    filter?.officialExtractLayer ?? official.layer,
  )
  const osmDownloadDetails = deriveDownloadDetails(
    osm.sourceDownloadUrl,
    osm.dataset ?? datasetFromDownloadUrl(osm.sourceDownloadUrl),
    undefined,
  )

  return (
    <section
      className={`mt-10 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 text-sm text-slate-400 shadow-sm ${className}`.trim()}
      aria-label={p.sectionAria}
    >
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">{p.title}</h2>
      </div>

      {!hideFreshnessSection ? (
        <div className="space-y-3 border-t border-b border-slate-700 px-4 py-6 sm:px-6">
          <DateLine
            label={p.reportCreatedLabel}
            abs={reportFresh.absoluteLine || EM_DASH}
            rel={reportFresh.relativeLine ?? EM_DASH}
          />
          <DateLine label={p.officialSourceStandLabel} abs={officialStandAbs} rel={EM_DASH} />
          {officialVerifiedFresh ? (
            <DateLine
              label={p.officialSourceVerifiedLabel}
              abs={officialVerifiedFresh.absoluteLine}
              rel={officialVerifiedFresh.relativeLine}
            />
          ) : null}
          {officialPublishedFresh ? (
            <DateLine
              label={p.officialSourcePublishedLabel}
              abs={officialPublishedFresh.absoluteLine}
              rel={officialPublishedFresh.relativeLine}
            />
          ) : null}
          <DateLine
            label={p.officialDownloadLabel}
            abs={officialGeomFresh.absoluteLine}
            rel={officialGeomFresh.relativeLine}
          />
          <DateLine
            label={p.osmDownloadLabel}
            abs={osmFresh.absoluteLine}
            rel={osmFresh.relativeLine}
          />
        </div>
      ) : null}

      <div className="border-t border-slate-700">
        <dl className="divide-y divide-slate-700/80">
          {compareProvenanceDlRows(data, row, filter)}

          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{p.officialSourceHeading}</h3>
            </dt>
            <dd className="mt-3 md:col-span-2 md:mt-0">
              <ul className="list-disc space-y-2 pl-5 text-slate-300 marker:text-slate-500">
                <SourceLinksList
                  sourcePublicUrl={official.sourcePublicUrl}
                  sourceDownloadUrl={official.sourceDownloadUrl}
                  sourceDownloadDetails={officialDownloadDetails}
                />
              </ul>
            </dd>
          </div>

          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{p.osmSourceHeading}</h3>
            </dt>
            <dd className="mt-3 md:col-span-2 md:mt-0">
              <ul className="list-disc space-y-2 pl-5 text-slate-300 marker:text-slate-500">
                <SourceLinksList
                  sourcePublicUrl={osm.sourcePublicUrl}
                  sourceDownloadUrl={osm.sourceDownloadUrl}
                  sourceDownloadDetails={osmDownloadDetails}
                />
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
