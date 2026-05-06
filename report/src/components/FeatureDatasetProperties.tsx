import { buildResolvedOsmSourceSide } from '../../../scripts/shared/osmGermanyProvenance.ts'
import { de } from '../i18n/de'
import {
  pickOfficialDatasetExtractDate,
  pickOsmDatasetExtractDate,
} from '../lib/datasetExtractDataDates'
import { EM_DASH } from '../lib/formatDe'
import { formatIsoTimestampToAbsoluteDe } from '../lib/formatSourceDownloadedAt'
import type { ComparisonForReport, ReportRow } from '../types/report'

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return de.feature.datasetPropertiesEmpty
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Drop noisy keys for display (e.g. @id duplicates OSM object identity elsewhere). */
function forDisplay(props: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!props) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (k === '@id') continue
    out[k] = v
  }
  return out
}

function DatasetPropertyCard({ properties }: { properties: Record<string, unknown> }) {
  const entries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b, 'de'))

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">{de.feature.datasetPropertiesEmpty}</p>
  }

  return (
    <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-mono text-xs break-words text-slate-400">{k}</dt>
          <dd className="break-words text-slate-100">{formatPropertyValue(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

function formatCaptionDate(raw: string | undefined): string {
  if (!raw?.trim()) return EM_DASH
  const s = formatIsoTimestampToAbsoluteDe(raw)
  return s || EM_DASH
}

function DatasetExtractDataDateCaption({
  sourceDateRaw,
  checkedAtRaw,
  geometryFetchedAtRaw,
  hasMetadata,
  note,
  labels,
  intro,
}: {
  sourceDateRaw: string | undefined
  checkedAtRaw: string | undefined
  /** Official: `official.downloadedAt`. OSM: omit for two-line snapshot / extract layout. */
  geometryFetchedAtRaw?: string | undefined
  hasMetadata: boolean
  note?: string | null
  labels?: { source: string; checked: string; geometryFetched?: string }
  /** Optional one-line context above the timestamp rows (e.g. official: three independent meanings). */
  intro?: string | null
}) {
  if (!hasMetadata) {
    return (
      <p className="text-xs leading-normal text-slate-400">{de.areaReport.sourceDateUnknown}</p>
    )
  }

  const checkedTrim = checkedAtRaw?.trim() ?? ''
  const geometryFetchedTrim = geometryFetchedAtRaw?.trim() ?? ''
  const showGeometryFetchedLine = geometryFetchedAtRaw !== undefined

  const sourceLb = labels?.source ?? de.feature.datasetExtractSourceDateLabel
  const checkedLb = labels?.checked ?? de.feature.datasetExtractCheckedDateLabel
  const geometryFetchedLb = labels?.geometryFetched ?? de.feature.datasetExtractGeometryFetchedLabel

  const sourceValue = sourceDateRaw
    ? formatCaptionDate(sourceDateRaw)
    : de.areaReport.sourceDateUnknown
  const checkedValue = checkedTrim !== '' ? formatCaptionDate(checkedAtRaw) : EM_DASH
  const geometryFetchedValue =
    geometryFetchedTrim !== '' ? formatCaptionDate(geometryFetchedAtRaw) : EM_DASH

  return (
    <div className="flex flex-col gap-0.5">
      {intro ? <p className="text-[11px] leading-snug text-slate-500">{intro}</p> : null}
      <p className="text-xs leading-normal text-slate-400">
        <span className="text-slate-500">{sourceLb}:</span> <span>{sourceValue}</span>
      </p>
      <p className="text-xs leading-normal text-slate-400">
        <span className="text-slate-500">{checkedLb}:</span> <span>{checkedValue}</span>
      </p>
      {showGeometryFetchedLine ? (
        <p className="text-xs leading-normal text-slate-400">
          <span className="text-slate-500">{geometryFetchedLb}:</span>{' '}
          <span>{geometryFetchedValue}</span>
        </p>
      ) : null}
      {note ? <p className="text-[11px] leading-snug text-slate-500">{note}</p> : null}
    </div>
  )
}

export function FeatureDatasetProperties({
  row,
  data,
}: {
  row: ReportRow
  data: ComparisonForReport
}) {
  const official = forDisplay(row.officialProperties)
  const osm = forDisplay(row.osmProperties)
  const hasOfficialMeta = data.sourceMetadata?.official != null
  const officialPick = pickOfficialDatasetExtractDate(data.sourceMetadata?.official)

  const osmResolved = buildResolvedOsmSourceSide(data.sourceMetadata?.osm)
  const osmPick = pickOsmDatasetExtractDate(osmResolved)
  const osmDataNote =
    osmPick.checkedAtRaw && !osmPick.snapshotFromPbfHeader
      ? de.feature.datasetExtractOsmUncertainNote
      : null
  const osmRelationId = row.osmRelationId.trim()
  const osmHistoryUrl =
    osmRelationId === '' ? null : `https://www.openstreetmap.org/relation/${osmRelationId}/history`
  const compactButtonClass =
    'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm ring-1 ring-inset transition-colors bg-slate-100 text-slate-900 ring-slate-300 hover:bg-slate-200'

  return (
    <section
      className="mt-10 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={de.feature.datasetPropertiesSectionAria}
    >
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">
          {de.feature.datasetPropertiesSectionTitle}
        </h2>
      </div>
      <div className="border-t border-slate-700">
        <dl className="divide-y divide-slate-700/80">
          <div className="bg-blue-950/18 px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt className="flex flex-col gap-1">
              <span className="text-sm/6 font-medium text-slate-200">
                {de.feature.datasetOfficialCardTitle}
              </span>
              <DatasetExtractDataDateCaption
                intro={de.feature.datasetExtractOfficialDatesIntro}
                sourceDateRaw={officialPick.sourceDateRaw}
                checkedAtRaw={officialPick.checkedAtRaw}
                geometryFetchedAtRaw={officialPick.geometryFetchedAtRaw}
                hasMetadata={hasOfficialMeta}
              />
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <DatasetPropertyCard properties={official} />
            </dd>
          </div>
          <div className="bg-red-950/18 px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt className="flex flex-col gap-2">
              <h3 className="text-sm/6 font-medium text-slate-200">
                {de.feature.datasetOsmCardTitle}
              </h3>
              <DatasetExtractDataDateCaption
                intro={de.feature.datasetExtractOsmDatesIntro}
                sourceDateRaw={osmPick.sourceDateRaw}
                checkedAtRaw={osmPick.checkedAtRaw}
                hasMetadata
                note={osmDataNote}
                labels={{
                  source: de.feature.datasetExtractOsmSnapshotLabel,
                  checked: de.feature.datasetExtractOsmExtractLabel,
                }}
              />
              {osmHistoryUrl && (
                <a
                  href={osmHistoryUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`${compactButtonClass} self-start`}
                >
                  {de.feature.datasetOsmOpenHistory}
                </a>
              )}
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <DatasetPropertyCard properties={osm} />
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
