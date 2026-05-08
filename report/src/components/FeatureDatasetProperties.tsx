import {
  CheckCircleIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/20/solid'
import { buildResolvedOsmSourceSide } from '../../../scripts/shared/osmGermanyProvenance.ts'
import { useOverpassRelationTags } from '../hooks/useOverpassRelationTags'
import { de } from '../i18n/de'
import { pickOsmDatasetExtractDate } from '../lib/datasetExtractDataDates'
import { EM_DASH } from '../lib/formatDe'
import { formatIsoTimestampToAbsoluteDe } from '../lib/formatSourceDownloadedAt'
import {
  germanKeyExplorerLinkValueOrNull,
  isGermanKeyExplorerDisplayKey,
} from '../lib/germanKeyExplorer'
import type { ComparisonForReport, ReportRow } from '../types/report'
import { GermanKeyVerifyLink } from './GermanKeyVerifyLink'
import { OfficialDatasetAgeInfoLink } from './OfficialDatasetAgeInfoModal'
import { sharedButtonClass } from './sharedButtonStyles'

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

/**
 * BKG VG250 fields that are technical/internal (e.g. ids, lifecycle, internal codes) and add
 * no value to the human review or to the OSM live comparison. Also includes `@id` from
 * `forDisplay` for symmetry.
 */
const OFFICIAL_HIDDEN_KEYS: ReadonlySet<string> = new Set([
  '@id',
  'OBJID',
  'BEGINN',
  'WSK',
  'AGS_0',
  'ARS_0',
  'SN_L',
  'SN_R',
  'SN_K',
  'SN_V1',
  'SN_V2',
  'SN_G',
  'FK_S3',
  'LKZ',
  'SDV_ARS',
  'GF',
])

/** Strip official-side noisy/internal keys before display and OSM live comparison. */
function forDisplayOfficial(
  props: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!props) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (OFFICIAL_HIDDEN_KEYS.has(k)) continue
    out[k] = v
  }
  return out
}

function DatasetPropertyCard({ properties }: { properties: Record<string, unknown> }) {
  const entries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b, 'de'))
  const verifyLinkClass =
    'shrink-0 text-xs font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">{de.feature.datasetPropertiesEmpty}</p>
  }

  return (
    <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {entries.map(([k, v]) => {
        const linkVal =
          isGermanKeyExplorerDisplayKey(k) && (typeof v === 'string' || typeof v === 'number')
            ? germanKeyExplorerLinkValueOrNull(v)
            : null
        return (
          <div key={k} className="contents">
            <dt className="font-mono text-xs break-words text-slate-400">{k}</dt>
            <dd className="min-w-0 break-words text-slate-100">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="min-w-0">{formatPropertyValue(v)}</span>
                {linkVal ? (
                  <GermanKeyVerifyLink keyValue={linkVal} className={verifyLinkClass} />
                ) : null}
              </span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/**
 * Renders OSM live tags alongside a status column comparing each value against the filtered
 * official record. After the live entries, keys that exist in the filtered official data but are
 * missing in OSM live are appended as orange "could be added" suggestions.
 */
function DatasetLiveComparedPropertyCard({
  properties,
  officialProperties,
}: {
  properties: Record<string, string>
  officialProperties: Record<string, unknown>
}) {
  const liveEntries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b, 'de'))
  const liveKeySet = new Set(liveEntries.map(([k]) => k))
  const missingOfficialEntries = Object.entries(officialProperties)
    .filter(([k]) => !liveKeySet.has(k))
    .sort(([a], [b]) => a.localeCompare(b, 'de'))
  if (liveEntries.length === 0 && missingOfficialEntries.length === 0) {
    return <p className="text-sm text-slate-400">{de.feature.datasetPropertiesEmpty}</p>
  }
  const codeClass =
    'inline-block rounded bg-slate-800/80 px-1 py-0.5 font-mono text-[11px] text-slate-100'
  return (
    <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)]">
      {liveEntries.map(([k, v]) => {
        const liveValue = formatPropertyValue(v).trim()
        const officialHasKey = Object.prototype.hasOwnProperty.call(officialProperties, k)
        const officialValue = officialHasKey
          ? formatPropertyValue(officialProperties[k]).trim()
          : null
        const sameAsOfficial = officialHasKey && officialValue === liveValue
        const valueClass = officialHasKey
          ? sameAsOfficial
            ? 'bg-emerald-900/45 text-emerald-100 ring-1 ring-emerald-700/60'
            : 'bg-amber-900/35 text-amber-100 ring-1 ring-amber-700/60'
          : 'text-slate-100'
        return (
          <div key={k} className="contents">
            <dt className="font-mono text-xs break-words text-slate-400">{k}</dt>
            <dd className="min-w-0 break-words">
              <span className={`inline-block min-w-0 rounded-sm px-1 py-0.5 ${valueClass}`}>
                {liveValue}
              </span>
            </dd>
            <dd className="flex min-w-0 items-start gap-1.5 break-words">
              {officialHasKey ? (
                sameAsOfficial ? (
                  <span
                    title={de.feature.datasetOsmLiveCompareMatchTooltip}
                    className="inline-flex items-center"
                  >
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="size-4 shrink-0 text-emerald-400"
                    />
                    <span className="sr-only">{de.feature.datasetOsmLiveCompareMatchTooltip}</span>
                  </span>
                ) : (
                  <>
                    <QuestionMarkCircleIcon
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-amber-500"
                    />
                    <span className="text-xs text-slate-300">
                      {de.feature.datasetOsmLiveCompareDifferentLabel}{' '}
                      <code className={codeClass}>{officialValue}</code>
                    </span>
                  </>
                )
              ) : null}
            </dd>
          </div>
        )
      })}
      {missingOfficialEntries.map(([k, v]) => {
        const officialValue = formatPropertyValue(v).trim()
        return (
          <div key={`missing-${k}`} className="contents">
            <dt className="font-mono text-xs break-words text-slate-400">{k}</dt>
            <dd className="min-w-0 text-slate-500 italic">{de.feature.datasetPropertiesEmpty}</dd>
            <dd className="flex min-w-0 items-start gap-1.5 break-words">
              <QuestionMarkCircleIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-orange-400"
              />
              <span className="text-xs text-slate-300">
                {de.feature.datasetOsmLiveCompareMissingPrefix}{' '}
                <code className={codeClass}>{officialValue}</code>{' '}
                {de.feature.datasetOsmLiveCompareMissingSuffix}
              </span>
            </dd>
          </div>
        )
      })}
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
}: {
  sourceDateRaw: string | undefined
  checkedAtRaw: string | undefined
  /** Official: `official.downloadedAt`. OSM: omit for two-line snapshot / extract layout. */
  geometryFetchedAtRaw?: string | undefined
  hasMetadata: boolean
  note?: string | null
  labels?: { source: string; checked: string; geometryFetched?: string }
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

function OsmLiveRelationTagsRow({
  osmRelationId,
  officialProperties,
}: {
  osmRelationId: string
  officialProperties: Record<string, unknown>
}) {
  const live = useOverpassRelationTags(osmRelationId)
  const captionText =
    live.status === 'done' && live.replicationDate
      ? `${de.feature.datasetOsmLiveOverpassQueryLabel}: ${formatIsoTimestampToAbsoluteDe(live.replicationDate)}`
      : null

  const errorMessage = (() => {
    if (live.status !== 'error' || !live.error) return null
    const raw = live.error instanceof Error ? live.error.message : String(live.error)
    if (raw === 'INVALID_OVERPASS_JSON') return de.feature.datasetOsmLiveInvalidJson
    if (raw.startsWith('Overpass request failed:'))
      return `${de.feature.datasetOsmLiveErrorPrefix} ${raw.replace('Overpass request failed:', '').trim()}`
    return raw
  })()

  return (
    <div className="bg-red-950/18 px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
      <dt className="flex flex-col gap-1">
        <span className="text-sm/6 font-medium text-slate-200">
          {de.feature.datasetOsmLiveCardTitle}
        </span>
        {captionText ? (
          <p className="text-xs leading-normal text-slate-400">{captionText}</p>
        ) : null}
      </dt>
      <dd className="mt-2 md:col-span-2 md:mt-0">
        {live.status === 'idle' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void live.run()} className={sharedButtonClass}>
                {de.feature.datasetOsmLiveButton}
              </button>
              <span className="text-xs text-slate-400">
                {de.feature.datasetOsmLiveButtonHint(osmRelationId)}
              </span>
            </div>
            <p className="flex items-start gap-1.5 text-xs text-slate-400">
              <InformationCircleIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-sky-300"
              />
              <span>{de.feature.datasetOsmLiveCompareHint}</span>
            </p>
          </div>
        )}

        {live.status === 'loading' && (
          <p className="text-sm text-slate-400">{de.feature.datasetOsmLiveLoading}</p>
        )}

        {live.status === 'error' && errorMessage && (
          <div className="space-y-2">
            <p className="text-sm text-red-400">{errorMessage}</p>
            <button type="button" onClick={() => void live.run()} className={sharedButtonClass}>
              {de.feature.datasetOsmLiveAgain}
            </button>
          </div>
        )}

        {live.status === 'done' && (
          <div className="space-y-3">
            {live.tags ? (
              <DatasetLiveComparedPropertyCard
                properties={live.tags}
                officialProperties={officialProperties}
              />
            ) : (
              <p className="text-sm text-slate-400">{de.feature.datasetOsmLiveEmpty}</p>
            )}
            <button
              type="button"
              onClick={() => void live.run()}
              className="text-sm text-violet-300/90 underline decoration-violet-400/30 underline-offset-2 hover:text-violet-200"
            >
              {de.feature.datasetOsmLiveAgain}
            </button>
          </div>
        )}
      </dd>
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
  const official = forDisplayOfficial(row.officialProperties)
  const osm = forDisplay(row.osmProperties)

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
              <OfficialDatasetAgeInfoLink side={data.sourceMetadata?.official} />
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
          {osmRelationId !== '' && (
            <OsmLiveRelationTagsRow osmRelationId={osmRelationId} officialProperties={official} />
          )}
        </dl>
      </div>
    </section>
  )
}
