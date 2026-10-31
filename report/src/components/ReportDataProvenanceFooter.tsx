import type { ReactElement, ReactNode } from 'react'
import { Fragment } from 'react'
import type { MatchRule } from '../../../scripts/shared/matchRules.ts'
import { buildResolvedOsmSourceSide } from '../../../scripts/shared/osmGermanyProvenance.ts'
import { areasIndex } from '../data/areasIndex'
import { de } from '../i18n/de'
import { renderWithAbbr, SourceTerm, sourceText } from '../i18n/sourceVocabulary'
import { DTP_OVERRIDE_OSM_REF_PROPERTY } from '../lib/dtpCorrection'
import { EM_DASH } from '../lib/formatDe'
import {
  formatFreshnessDisplayDe,
  formatIsoTimestampToDateOnlyDe,
} from '../lib/formatSourceDownloadedAt'
import {
  germanKeyExplorerLinkValueOrNull,
  isSchluesselExplorerPreset,
} from '../lib/germanKeyExplorer'
import { boundaryTagValues } from '../lib/postpass'
import { optionalSourceStatLines, sourceStatLines } from '../lib/reportFreshnessLines'
import {
  matchedRuleOfRow,
  osmObjectRefFromReference,
  reportMatchRules,
} from '../lib/reportMatchRules'
import type { ComparisonFilterConfigSummary, ComparisonForReport, ReportRow } from '../types/report'
import { GermanKeyVerifyLink } from './GermanKeyVerifyLink'
import { OfficialDatasetAgeInfoLink } from './OfficialDatasetAgeInfoModal'
import { ProvenanceGridRow } from './ProvenanceGridRow'
import { ProvenanceGridSectionHeader } from './ProvenanceGridSectionHeader'

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

function FilterItem({
  code,
  description,
  renderDescription,
}: {
  code: string
  description: string
  renderDescription?: (text: string) => ReactNode
}) {
  return (
    <li>
      <span className="block">
        <code className="break-all text-slate-500">{code}</code>
      </span>
      <span className="block">
        {renderDescription ? renderDescription(description) : description}
      </span>
    </li>
  )
}

function matchRuleItem(
  rule: MatchRule,
  position: number,
  data: ComparisonForReport,
  officialMatchProperty: string | undefined,
): { code: string; description: string } {
  const d = de.provenance.matchRuleDescriptions
  const number = position + 1
  const sourceData = sourceText(data.sourceKind, 'dataLabelDative')
  switch (rule.kind) {
    case 'key':
      return {
        code: `${number}. key: ${rule.officialProperty} ↔ ${rule.osmTag}`,
        description: d.key(rule.officialProperty, rule.osmTag, sourceData),
      }
    case 'relation_id': {
      const ids = rule.relationIds.join(', ')
      return {
        code: `${number}. relation_id: ${ids}`,
        description: d.relation_id(ids, officialMatchProperty ?? ''),
      }
    }
    case 'osm_reference':
      return {
        code: `${number}. osm_reference: ${rule.officialProperty}`,
        // Our reviewed correction; DtP does not name this object, so the generic text would be wrong.
        description:
          rule.officialProperty === DTP_OVERRIDE_OSM_REF_PROPERTY
            ? d.osm_reference_override
            : d.osm_reference(rule.officialProperty, sourceData),
      }
    case 'osm_tag':
      return {
        code: `${number}. osm_tag: ${rule.officialProperty} ↔ ${rule.osmTag}`,
        description: d.osm_tag(rule.officialProperty, rule.osmTag, sourceData),
      }
  }
}

/** "Zugeordnet über Regel 2 (OSM-Verweis der DtP-Daten: relation/123)" for a matched row. */
function matchedRuleText(
  row: ReportRow,
  rule: MatchRule,
  position: number,
  data: ComparisonForReport,
): string {
  const how = de.provenance.matchedByHow
  const sourceData = sourceText(data.sourceKind, 'dataLabelDative')
  const officialValue = (property: string) => row.officialProperties?.[property]
  const detail =
    rule.kind === 'key'
      ? how.key
      : rule.kind === 'relation_id'
        ? how.relation_id
        : rule.kind === 'osm_reference'
          ? rule.officialProperty === DTP_OVERRIDE_OSM_REF_PROPERTY
            ? how.osm_override(osmObjectRefFromReference(officialValue(rule.officialProperty)))
            : how.osm_reference(
                sourceData,
                osmObjectRefFromReference(officialValue(rule.officialProperty)),
              )
          : how.osm_tag(rule.osmTag, String(officialValue(rule.officialProperty) ?? '').trim())
  return de.provenance.matchedByRule(position + 1, detail)
}

function resolvedOsmMatchProperties(
  data: ComparisonForReport,
  filter: ComparisonFilterConfigSummary | undefined,
): string[] {
  const summary = areasIndex.summaries.find((x) => x.area === data.area)
  const fromFilter =
    filter?.osmMatchProperties?.map((x) => x.trim()).filter((x) => x.length > 0) ?? []
  if (fromFilter.length > 0) return fromFilter
  return summary?.osmMatchProperties?.map((x) => x.trim()).filter((x) => x.length > 0) ?? []
}

function compareMappingItems(
  data: ComparisonForReport,
  filter: ComparisonFilterConfigSummary | undefined,
) {
  const p = de.provenance
  const osmMatchProps = resolvedOsmMatchProperties(data, filter)
  const preset = data.idNormalizationPreset
  const rules = reportMatchRules(data, osmMatchProps)

  const presetLabels = {
    ...de.germanKeyExplorer.presets,
    ...de.provenance.idNormalizationPresetExtraLabels,
  }
  const items: ReactElement[] = []

  rules.forEach((rule, position) => {
    const { code, description } = matchRuleItem(
      rule,
      position,
      data,
      filter?.officialMatchProperty?.trim(),
    )
    items.push(
      <FilterItem
        key={`compare-rule-${position}`}
        code={code}
        description={description}
        renderDescription={renderWithAbbr}
      />,
    )
  })

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
  const boundaryValues = boundaryTagValues(boundaryValue)
  const osmItems: ReactElement[] = []
  const officialItems: ReactElement[] = []

  osmItems.push(
    <FilterItem
      key="compare-boundary"
      code={boundaryValues.map((value) => `boundary=${value}`).join(' | ')}
      description={
        boundaryValues.length > 1
          ? p.compareBoundaryTagMultiple(boundaryValues.join(', '))
          : p.compareBoundaryTag(boundaryValue)
      }
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

  if (filter?.officialExtractFilter) {
    const { property, valuePrefix, excludeValues } = filter.officialExtractFilter
    if (valuePrefix) {
      officialItems.push(
        <FilterItem
          key="compare-official-extract-filter"
          code={`officialExtractFilter.${property}=${valuePrefix}*`}
          description={p.filterDescriptions.officialExtractFilter(property, valuePrefix)}
        />,
      )
    }
    if (excludeValues && excludeValues.length > 0) {
      officialItems.push(
        <FilterItem
          key="compare-official-extract-exclude"
          code={`officialExtractFilter.${property}!=${excludeValues.join(',')}`}
          description={p.filterDescriptions.officialExtractExclude(property, excludeValues)}
        />,
      )
    }
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
  const rules = reportMatchRules(data, resolvedOsmMatchProperties(data, filter))
  const { osmItems, officialItems } = compareFilterItems(data, filter)
  // Only German Schlüssel (ARS/AGS) can be checked in the Schlüssel-Explorer, not PLZ or WDPA ids.
  const explorerKey =
    row == null || !isSchluesselExplorerPreset(data.idNormalizationPreset)
      ? null
      : germanKeyExplorerLinkValueOrNull(row.canonicalMatchKey)
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
            label: <SourceTerm kind={data.sourceKind} term="dataHeading" />,
            showExplorerLink: row.category !== 'unmatched_osm' && explorerKey != null,
          },
        ]

  const matchedRule = row == null ? null : matchedRuleOfRow(row, rules)
  const matchedRuleLine =
    row == null || matchedRule == null
      ? null
      : matchedRuleText(row, matchedRule.rule, matchedRule.position, data)

  if (mappingItems.length === 0 && osmItems.length === 0 && officialItems.length === 0) {
    return (
      <ProvenanceGridRow asDl leftColumnClassName="sr-only" title={p.compareHeading}>
        <p className="text-slate-500" role="note">
          {p.compareNoCompareConfig}
        </p>
      </ProvenanceGridRow>
    )
  }

  return (
    <Fragment>
      {compareDataItems.length > 0 ? (
        <ProvenanceGridRow
          asDl
          title={<h3 className="text-sm/6 font-medium text-slate-200">{p.compareDataHeading}</h3>}
        >
          <p className="text-xs text-slate-400">{p.compareDataLead}</p>
          {matchedRuleLine ? (
            <p className="mt-2 text-sm text-slate-300">{renderWithAbbr(matchedRuleLine)}</p>
          ) : null}
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
        </ProvenanceGridRow>
      ) : null}

      <ProvenanceGridRow
        asDl
        title={<h3 className="text-sm/6 font-medium text-slate-200">{p.compareMappingHeading}</h3>}
      >
        <p className="text-xs text-slate-400">
          {p.compareMappingLeadWithMetricsCrs(data.metricsCrs)}
        </p>
        {rules.length > 1 ? (
          <p className="mt-2 text-xs text-slate-400">{p.compareRulesOrderLead}</p>
        ) : null}
        {mappingItems.length > 0 ? (
          <ul className="mt-3 list-disc space-y-3 pl-5 text-slate-300 marker:text-slate-500">
            {mappingItems}
          </ul>
        ) : (
          <p className="mt-2 text-slate-500">{p.compareMappingEmpty}</p>
        )}
      </ProvenanceGridRow>

      <ProvenanceGridRow
        asDl
        title={
          <h3 className="text-sm/6 font-medium text-slate-200">{p.compareOsmFilterHeading}</h3>
        }
      >
        <p className="text-xs text-slate-400">{p.compareFilterLead}</p>
        {osmItems.length > 0 ? (
          <ul className="mt-3 list-disc space-y-3 pl-5 text-slate-300 marker:text-slate-500">
            {osmItems}
          </ul>
        ) : (
          <p className="mt-2 text-slate-500">{p.compareFilterEmpty}</p>
        )}
      </ProvenanceGridRow>

      <ProvenanceGridRow
        asDl
        title={
          <h3 className="text-sm/6 font-medium text-slate-200">{p.compareOfficialFilterHeading}</h3>
        }
      >
        {officialItems.length > 0 ? (
          <ul className="list-disc space-y-3 pl-5 text-slate-300 marker:text-slate-500">
            {officialItems}
          </ul>
        ) : (
          <p className="mt-2 text-slate-500">{p.compareFilterEmpty}</p>
        )}
      </ProvenanceGridRow>
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
      className={`overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 text-sm text-slate-400 shadow-sm ${className}`.trim()}
      aria-label={p.sectionAria}
    >
      <ProvenanceGridSectionHeader title={p.title} />

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

          <ProvenanceGridRow
            asDl
            title={
              <h3 className="text-sm/6 font-medium text-slate-200">{p.officialSourceHeading}</h3>
            }
            titleAside={<OfficialDatasetAgeInfoLink side={official} />}
            leftColumnClassName="flex flex-col gap-1"
          >
            <ul className="list-disc space-y-2 pl-5 text-slate-300 marker:text-slate-500">
              <SourceLinksList
                sourcePublicUrl={official.sourcePublicUrl}
                sourceDownloadUrl={official.sourceDownloadUrl}
                sourceDownloadDetails={officialDownloadDetails}
              />
            </ul>
          </ProvenanceGridRow>

          <ProvenanceGridRow
            asDl
            title={<h3 className="text-sm/6 font-medium text-slate-200">{p.osmSourceHeading}</h3>}
          >
            <ul className="list-disc space-y-2 pl-5 text-slate-300 marker:text-slate-500">
              <SourceLinksList
                sourcePublicUrl={osm.sourcePublicUrl}
                sourceDownloadUrl={osm.sourceDownloadUrl}
                sourceDownloadDetails={osmDownloadDetails}
              />
            </ul>
          </ProvenanceGridRow>
        </dl>
      </div>
    </section>
  )
}
