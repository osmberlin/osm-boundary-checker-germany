import { de } from '../i18n/de'
import { EM_DASH } from '../lib/formatDe'
import { formatFreshnessDisplayDe } from '../lib/formatSourceDownloadedAt'
import { optionalSourceStatLines, sourceStatLines } from '../lib/reportFreshnessLines'
import type { ComparisonFilterConfigSummary, ComparisonForReport } from '../types/report'

export type ReportDataProvenanceFooterProps = {
  data: ComparisonForReport
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
        <span className="text-slate-500">:</span>
      </span>
      <span className="block">{description}</span>
    </li>
  )
}

function officialFilterItems(filter: ComparisonFilterConfigSummary | undefined) {
  const p = de.provenance
  if (!filter) {
    return [
      <li key="no-config" className="text-slate-500">
        {p.noFilterConfig}
      </li>,
    ]
  }
  const items = [
    <FilterItem
      key="official-match-property"
      code={`officialMatchProperty=${filter.officialMatchProperty}`}
      description={p.filterDescriptions.officialMatchProperty(filter.officialMatchProperty)}
    />,
    <FilterItem
      key="bbox-filter"
      code={`bboxFilter=${filter.bboxFilter}`}
      description={p.filterDescriptions.bboxFilter[filter.bboxFilter]}
    />,
  ]
  if (filter.bboxBufferDegrees !== undefined) {
    items.push(
      <FilterItem
        key="bbox-buffer"
        code={`bboxBufferDegrees=${filter.bboxBufferDegrees}`}
        description={p.filterDescriptions.bboxBufferDegrees(filter.bboxBufferDegrees)}
      />,
    )
  }
  if (filter.officialExtractLayer?.trim()) {
    items.push(
      <FilterItem
        key="official-extract-layer"
        code={`officialExtractLayer=${filter.officialExtractLayer.trim()}`}
        description="Dieser GDAL/WFS-Layer wird aus der amtlichen Quelle extrahiert."
      />,
    )
  }
  return items
}

function osmFilterItems(
  filter: ComparisonFilterConfigSummary | undefined,
  osmNote: string | undefined,
) {
  const p = de.provenance
  if (!filter && !osmNote?.trim()) {
    return [
      <li key="no-config" className="text-slate-500">
        {p.noFilterConfig}
      </li>,
    ]
  }
  const items = []
  if (filter) {
    items.push(
      <FilterItem
        key="osm-scope-filter"
        code={`osmScopeFilter=${filter.osmScopeFilter}`}
        description={p.filterDescriptions.osmScopeFilter[filter.osmScopeFilter]}
      />,
    )
    if ((filter.ignoreRelationIds?.length ?? 0) > 0) {
      const ids = filter.ignoreRelationIds!.join(',')
      items.push(
        <FilterItem
          key="ignore-relations"
          code={`ignoreRelationIds=${ids}`}
          description={p.filterDescriptions.ignoreRelationIds}
        />,
      )
    }
  }
  if (osmNote?.trim()) {
    items.push(
      <li key="osm-note">
        <span className="text-slate-500">{p.osmFilterNoteTitle}: </span>
        <span>{osmNote.trim()}</span>
      </li>,
    )
  }
  return items
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
  className = '',
  hideFreshnessSection = false,
}: ReportDataProvenanceFooterProps) {
  const p = de.provenance
  const { official, osm } = data.sourceMetadata
  const filter = data.filterConfigSummary

  const reportFresh = formatFreshnessDisplayDe(data.generatedAt.trim())
  const officialFresh = sourceStatLines(official.downloadedAt, true)
  const officialUpdatedFresh = optionalSourceStatLines(official.sourceUpdatedAt)
  const officialPublishedFresh = optionalSourceStatLines(official.sourcePublishedAt)
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
      className={`mt-14 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 text-sm text-slate-400 shadow-sm ${className}`.trim()}
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
          {officialUpdatedFresh ? (
            <DateLine
              label={p.officialSourceUpdatedLabel}
              abs={officialUpdatedFresh.absoluteLine}
              rel={officialUpdatedFresh.relativeLine}
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
            abs={officialFresh.absoluteLine}
            rel={officialFresh.relativeLine}
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
          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{p.officialHeading}</h3>
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
              <h3 className="text-sm/6 font-medium text-slate-200">{p.officialFilterHeading}</h3>
            </dt>
            <dd className="mt-3 md:col-span-2 md:mt-0">
              <ul className="list-disc space-y-3 pl-5 text-slate-300 marker:text-slate-500">
                {officialFilterItems(filter)}
              </ul>
            </dd>
          </div>

          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{p.osmHeading}</h3>
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

          <div className="px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt>
              <h3 className="text-sm/6 font-medium text-slate-200">{p.osmFilterHeading}</h3>
            </dt>
            <dd className="mt-3 md:col-span-2 md:mt-0">
              <ul className="list-disc space-y-3 pl-5 text-slate-300 marker:text-slate-500">
                {osmFilterItems(filter, osm.note)}
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
