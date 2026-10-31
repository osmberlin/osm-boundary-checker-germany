import {
  CheckCircleIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/20/solid'
import { useState } from 'react'
import {
  evaluateAttributeChecks,
  type AttributeCheckResult,
} from '../../../scripts/shared/attributeChecks.ts'
import { buildResolvedOsmSourceSide } from '../../../scripts/shared/osmGermanyProvenance.ts'
import type { SourceKind } from '../../../scripts/shared/sourceKind.ts'
import type { WikidataShard } from '../../../scripts/shared/wikidataProtectedAreasPayload.ts'
import { useOverpassRelationTags } from '../hooks/useOverpassRelationTags'
import { de } from '../i18n/de'
import { renderWithAbbr, SourceTerm, sourceText } from '../i18n/sourceVocabulary'
import { pickOsmDatasetExtractDate } from '../lib/datasetExtractDataDates'
import { EM_DASH } from '../lib/formatDe'
import { formatIsoTimestampToAbsoluteDe } from '../lib/formatSourceDownloadedAt'
import {
  germanKeyExplorerLinkValueOrNull,
  isGermanKeyExplorerDisplayKey,
} from '../lib/germanKeyExplorer'
import { liveOsmTagMarkers, type LiveOsmTagMarker } from '../lib/liveOsmChecks'
import {
  parseLiveOsmObjectRef,
  parseReportRowOsmRef,
  type ParsedReportRowOsmRef,
} from '../lib/osmObjectRef'
import type { AttributeHint, CandidateMatch, ComparisonForReport, ReportRow } from '../types/report'
import { CopyTagsButton } from './featureDetail/CopyTagsButton'
import {
  LiveOsmObjectLoadButton,
  LiveOsmObjectResult,
  type LiveOsmContext,
} from './featureDetail/LiveOsmObject'
import { WikidataAttributesRow } from './featureDetail/WikidataAttributesRow'
import { GermanKeyVerifyLink } from './GermanKeyVerifyLink'
import { OfficialDatasetAgeInfoLink } from './OfficialDatasetAgeInfoModal'
import { ProvenanceGridRow } from './ProvenanceGridRow'
import { ProvenanceGridSectionHeader } from './ProvenanceGridSectionHeader'
import { sharedButtonClass } from './sharedButtonStyles'
import { TagValue } from './TagValue'
import { CompareMarker } from './ui/CompareMarker'
import { MarkedValue } from './ui/MarkedValue'
import { Tooltip } from './ui/Tooltip'

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
  'IBZ',
  'LKZ',
  'SDV_ARS',
  'GF',
])

type OfficialToOsmMapping = {
  osmKey: string
  altOsmKeys?: string[]
  wikiUrl: string
  toOsmValues?: (officialValue: string) => string[]
}

/**
 * Official → OSM key transposition used for live comparison.
 * Only keys listed here are compared and suggested as "could be added".
 */
const OFFICIAL_TO_OSM_KEY: Readonly<Record<string, OfficialToOsmMapping>> = {
  AGS: {
    osmKey: 'de:amtlicher_gemeindeschluessel',
    wikiUrl: 'https://wiki.openstreetmap.org/wiki/DE:Key:de:amtlicher_gemeindeschluessel',
  },
  ARS: {
    osmKey: 'de:regionalschluessel',
    wikiUrl: 'https://wiki.openstreetmap.org/wiki/DE:Key:de:regionalschluessel',
  },
  GEN: {
    osmKey: 'name',
    wikiUrl: 'https://wiki.openstreetmap.org/wiki/Key:name',
  },
  BEZ: {
    osmKey: 'admin_title',
    altOsmKeys: ['admin_title:de'],
    wikiUrl: 'https://wiki.openstreetmap.org/wiki/Key:admin_title',
  },
  ADE: {
    osmKey: 'admin_level',
    wikiUrl: 'https://wiki.openstreetmap.org/wiki/DE:Grenze',
    toOsmValues: (officialValue: string) => {
      switch (officialValue.trim()) {
        case '1':
          return ['2']
        case '2':
          return ['4']
        case '3':
          return ['5']
        case '4':
          return ['6']
        case '5':
          return ['7']
        case '6':
          return ['7', '8']
        default:
          return []
      }
    },
  },
  NUTS: {
    osmKey: 'ref:nuts:3',
    altOsmKeys: ['ref:nuts'],
    wikiUrl: 'https://wiki.openstreetmap.org/wiki/Key:ref:nuts',
  },
}

type TransposedOfficialEntry = {
  officialKey: string
  osmKeys: string[]
  officialValue: string
  expectedOsmValues: string[]
  wikiUrl: string
}

type VerificationIndicatorEntry = {
  key: string
  value: string
}

const DATASET_INDICATORS_HEADING = 'Hinweise zur Verifizierung'
const DATASET_INDICATORS_LEAD =
  'Diese Felder werden nicht direkt gegen OSM-Tags verglichen, können aber zur Plausibilitätsprüfung genutzt werden.'

const OFFICIAL_VERIFICATION_INDICATORS: Readonly<Record<string, string>> = {
  BEM: 'Bemerkung zur administrativen Einordnung (z. B. kreisfrei) als Kontext für die Prüfung.',
  BSG: 'Sondergebiets-Kennzeichnung (z. B. Bodensee/Hoheitsgebiet) für Ausnahmefälle.',
  NBD: 'Kennzeichnet, ob die Bezeichnung Bestandteil des amtlichen Namens ist (Namensprüfung).',
}

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

function transposeOfficialToOsm(
  officialProps: Record<string, unknown>,
): Map<string, TransposedOfficialEntry> {
  const out = new Map<string, TransposedOfficialEntry>()
  for (const [officialKey, rawValue] of Object.entries(officialProps)) {
    const mapped = OFFICIAL_TO_OSM_KEY[officialKey]
    if (!mapped) continue
    const officialValue = formatPropertyValue(rawValue).trim()
    const expectedOsmValues =
      mapped.toOsmValues != null ? mapped.toOsmValues(officialValue) : [officialValue]
    if (expectedOsmValues.length === 0) continue
    out.set(mapped.osmKey, {
      officialKey,
      osmKeys: [mapped.osmKey, ...(mapped.altOsmKeys ?? [])],
      officialValue,
      expectedOsmValues,
      wikiUrl: mapped.wikiUrl,
    })
  }
  return out
}

function verificationIndicatorsFromOfficial(
  officialProps: Record<string, unknown>,
): VerificationIndicatorEntry[] {
  return Object.entries(officialProps)
    .filter(([key]) => Object.prototype.hasOwnProperty.call(OFFICIAL_VERIFICATION_INDICATORS, key))
    .map(([key, rawValue]) => ({ key, value: formatPropertyValue(rawValue).trim() }))
    .sort((a, b) => a.key.localeCompare(b.key, 'de'))
}

const HTTP_URL_PATTERN = /^https?:\/\//

function attributeCheckOsmPairs(result: AttributeCheckResult): string {
  return result.osm.map(({ key, value }) => `${key}=${value}`).join(', ')
}

function attributeCheckTooltip(
  result: AttributeCheckResult,
  sourceKind: SourceKind | undefined,
): string {
  const pairs = attributeCheckOsmPairs(result)
  switch (result.status) {
    case 'equal':
      return pairs === ''
        ? de.feature.datasetAttributeCheckEqualTooltipNoPairs
        : de.feature.datasetAttributeCheckEqualTooltip(pairs)
    case 'missing_osm':
      return de.feature.datasetAttributeCheckMissingOsmTooltip
    case 'missing_reference':
      return de.feature.datasetAttributeCheckMissingReferenceTooltip(
        sourceText(sourceKind, 'dataAtLabel'),
      )
    case 'different':
    case 'missing':
      return result.expectedTags
        ? `${de.feature.datasetAttributeCheckDifferentTooltip(pairs)} · ${de.feature.datasetAttributeCheckExpectedTooltip(result.expectedTags.join(', '))}`
        : de.feature.datasetAttributeCheckDifferentTooltip(pairs)
  }
}

function tagPairs(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ')
}

/**
 * Markers of the check results next to the official property they belong to: ✓ equal, ≠ different,
 * ∅ missing in OSM. (The OSM list gets its markers from `liveOsmTagMarkers`.)
 */
function OfficialCheckMarkers({
  results,
  propertyKey,
  sourceKind,
}: {
  results: readonly AttributeCheckResult[]
  propertyKey: string
  sourceKind: SourceKind | undefined
}) {
  return results
    .filter((result) => result.official === propertyKey && result.status !== 'missing_reference')
    .map((result) => (
      <CompareMarker
        key={result.label}
        equal={result.status === 'equal'}
        missing={result.status === 'missing_osm'}
        tooltip={attributeCheckTooltip(result, sourceKind)}
      />
    ))
}

const CHIP_CLASS =
  'inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset'
const CHIP_EQUAL_CLASS = 'bg-emerald-900/30 text-emerald-200 ring-emerald-700/60'
const CHIP_WARN_CLASS = 'bg-amber-900/30 text-amber-200 ring-amber-700/60'
const CHIP_NEUTRAL_CLASS = 'bg-slate-800/60 text-slate-200 ring-slate-600/70'
const CHIP_CODE_CLASS = 'rounded bg-slate-950/60 px-1 font-mono text-[11px] break-all'

function AttributeCheckChip({
  result,
  sourceKind,
}: {
  result: AttributeCheckResult
  sourceKind: SourceKind | undefined
}) {
  const tooltip = attributeCheckTooltip(result, sourceKind)
  const suggested = result.suggestedTags ?? {}
  const hasSuggestion = Object.keys(suggested).length > 0
  switch (result.status) {
    case 'equal':
    case 'different': {
      const equal = result.status === 'equal'
      const combinedName = result.compare === 'name' && result.osmKeys.length > 1 && equal
      return (
        <li className={`${CHIP_CLASS} ${equal ? CHIP_EQUAL_CLASS : CHIP_WARN_CLASS}`}>
          <Tooltip text={tooltip} as="span" className="cursor-help">
            {equal ? '✓' : '≠'}{' '}
            {equal ? de.feature.datasetAttributeCheckEqualChip(result.label) : result.label}
            {combinedName ? ` (${de.feature.datasetAttributeCheckCombinedNameRule})` : ''}
          </Tooltip>
          {!equal && hasSuggestion ? (
            <CopyTagsButton
              tags={suggested}
              ariaLabel={de.feature.datasetAttributeCheckCopyAria(result.label)}
            />
          ) : null}
        </li>
      )
    }
    case 'missing_osm':
      return (
        <li className={`${CHIP_CLASS} ${CHIP_WARN_CLASS}`}>
          <Tooltip text={tooltip} as="span" className="cursor-help">
            + {de.feature.datasetAttributeCheckMissingOsmChip(result.label)}
            {hasSuggestion ? ':' : ''}
          </Tooltip>
          {hasSuggestion ? (
            <>
              <code className={CHIP_CODE_CLASS}>{tagPairs(suggested)}</code>
              <CopyTagsButton
                tags={suggested}
                ariaLabel={de.feature.datasetAttributeCheckCopyAria(result.label)}
              />
            </>
          ) : null}
        </li>
      )
    case 'missing_reference':
      return (
        <li className={`${CHIP_CLASS} ${CHIP_WARN_CLASS}`}>
          <Tooltip text={tooltip} as="span" className="cursor-help">
            {renderWithAbbr(
              de.feature.datasetAttributeCheckMissingReferenceChip(
                result.label,
                sourceText(sourceKind, 'dataAtLabel'),
                result.osm.map((pair) => pair.value).join(', '),
              ),
            )}
          </Tooltip>
        </li>
      )
    case 'missing':
      return null
  }
}

/** Hints without an attribute check counterpart (today: DtP names another OSM object). */
function AttributeHintChip({ hint }: { hint: AttributeHint }) {
  const t = de.feature.attributeHints
  return (
    <li className={`${CHIP_CLASS} ${CHIP_NEUTRAL_CLASS}`}>
      <Tooltip
        text={t.osmRefDiffersTooltip(hint.expected.join(', '), hint.actual.join(', '))}
        as="span"
        className="cursor-help"
      >
        {renderWithAbbr(t.osmRefDiffers)}
      </Tooltip>
    </li>
  )
}

/** One line of small chips above the two lists: check results (equal, different, missing) and hints. */
function AttributeCheckSummary({
  results,
  hints,
  sourceKind,
}: {
  results: readonly AttributeCheckResult[]
  hints: readonly AttributeHint[]
  sourceKind: SourceKind | undefined
}) {
  const shown = results.filter((result) => result.status !== 'missing')
  if (shown.length === 0 && hints.length === 0) return null
  return (
    <ul
      aria-label={de.feature.datasetAttributeChecksAria}
      className="flex flex-wrap gap-x-2 gap-y-1 border-b border-slate-700/80 px-4 py-3 sm:px-6"
    >
      {shown.map((result) => (
        <AttributeCheckChip
          key={`${result.official}-${result.label}`}
          result={result}
          sourceKind={sourceKind}
        />
      ))}
      {hints.map((hint) => (
        <AttributeHintChip key={hint.id} hint={hint} />
      ))}
    </ul>
  )
}

function DatasetPropertyCard({
  properties,
  checkResults,
  osmTagMarkers,
  sourceKind,
  emptyText = de.feature.datasetPropertiesEmpty,
}: {
  properties: Record<string, unknown>
  /** Official list: attribute check results; markers show next to the property they belong to. */
  checkResults?: readonly AttributeCheckResult[]
  /** OSM list: markers per OSM tag key (the keys the attribute checks read). */
  osmTagMarkers?: ReadonlyMap<string, LiveOsmTagMarker[]>
  sourceKind?: SourceKind | undefined
  /** Shown instead of the list when there are no properties. */
  emptyText?: string
}) {
  const entries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b, 'de'))
  const verifyLinkClass =
    'shrink-0 text-xs font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">{emptyText}</p>
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
              <MarkedValue
                markers={
                  <>
                    {linkVal ? (
                      <GermanKeyVerifyLink keyValue={linkVal} className={verifyLinkClass} />
                    ) : null}
                    {checkResults ? (
                      <OfficialCheckMarkers
                        results={checkResults}
                        propertyKey={k}
                        sourceKind={sourceKind}
                      />
                    ) : null}
                    {(osmTagMarkers?.get(k) ?? []).map((marker) => (
                      <CompareMarker
                        key={marker.tooltip}
                        equal={marker.equal}
                        missing={marker.missing}
                        tooltip={marker.tooltip}
                      />
                    ))}
                  </>
                }
              >
                {typeof v === 'string' && HTTP_URL_PATTERN.test(v) ? (
                  <a
                    href={v}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
                  >
                    {v}
                  </a>
                ) : (
                  <TagValue tagKey={k} value={formatPropertyValue(v)} />
                )}
              </MarkedValue>
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
  acceptedRegionalSchluessel,
  sourceKind,
}: {
  properties: Record<string, string>
  officialProperties: Record<string, unknown>
  acceptedRegionalSchluessel?: string | null
  sourceKind: SourceKind | undefined
}) {
  const officialByOsmKeyPrimary = transposeOfficialToOsm(officialProperties)
  const officialByAnyOsmKey = new Map<string, TransposedOfficialEntry>()
  for (const entry of officialByOsmKeyPrimary.values()) {
    for (const osmKey of entry.osmKeys) {
      officialByAnyOsmKey.set(osmKey, entry)
    }
  }
  const verificationIndicators = verificationIndicatorsFromOfficial(officialProperties)
  const liveEntries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b, 'de'))
  const liveKeySet = new Set(liveEntries.map(([k]) => k))
  const missingOfficialEntries = Array.from(officialByOsmKeyPrimary.values())
    .filter((entry) => entry.osmKeys.every((osmKey) => !liveKeySet.has(osmKey)))
    .sort((a, b) => a.osmKeys[0]!.localeCompare(b.osmKeys[0]!, 'de'))
  if (liveEntries.length === 0 && missingOfficialEntries.length === 0) {
    return <p className="text-sm text-slate-400">{de.feature.datasetPropertiesEmpty}</p>
  }
  const codeClass =
    'inline-block rounded bg-slate-800/80 px-1 py-0.5 font-mono text-[11px] text-slate-100'
  return (
    <>
      <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)]">
        {liveEntries.map(([k, v]) => {
          const liveValue = formatPropertyValue(v).trim()
          const mappedOfficial = officialByAnyOsmKey.get(k)
          const officialHasKey = mappedOfficial != null
          const expectedValues = mappedOfficial?.expectedOsmValues ?? []
          const acceptedExtra =
            k === 'de:regionalschluessel' && acceptedRegionalSchluessel
              ? [acceptedRegionalSchluessel]
              : []
          const sameAsOfficial =
            officialHasKey && [...expectedValues, ...acceptedExtra].includes(liveValue)
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
                  <TagValue tagKey={k} value={liveValue} />
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
                      <span className="sr-only">
                        {de.feature.datasetOsmLiveCompareMatchTooltip}
                      </span>
                    </span>
                  ) : (
                    <>
                      <QuestionMarkCircleIcon
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-amber-500"
                      />
                      <span className="text-xs text-slate-300">
                        <SourceTerm kind={sourceKind} term="dataHeading" />:{' '}
                        <code className={codeClass}>
                          <TagValue tagKey={k} value={expectedValues.join(' | ')} />
                        </code>
                        {mappedOfficial ? (
                          <>
                            {' '}
                            <a
                              href={mappedOfficial.wikiUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                            >
                              OSM Wiki
                            </a>
                          </>
                        ) : null}
                      </span>
                    </>
                  )
                ) : null}
              </dd>
            </div>
          )
        })}
        {missingOfficialEntries.map((entry) => {
          const osmKey = entry.osmKeys[0] ?? ''
          const expectedOsm = entry.expectedOsmValues.join(' | ')
          return (
            <div key={`missing-${osmKey}`} className="contents">
              <dt className="font-mono text-xs break-words text-slate-400">{osmKey}</dt>
              <dd className="min-w-0 text-slate-500 italic">{de.feature.datasetPropertiesEmpty}</dd>
              <dd className="flex min-w-0 items-start gap-1.5 break-words">
                <QuestionMarkCircleIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-orange-400"
                />
                <span className="text-xs text-slate-300">
                  {de.feature.datasetOsmLiveCompareMissingPrefix}{' '}
                  <code className={codeClass}>
                    <TagValue tagKey={osmKey} value={expectedOsm} />
                  </code>{' '}
                  {de.feature.datasetOsmLiveCompareMissingSuffix}{' '}
                  <a
                    href={entry.wikiUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
                  >
                    OSM Wiki
                  </a>
                </span>
              </dd>
            </div>
          )
        })}
      </dl>
      {verificationIndicators.length > 0 ? (
        <div className="mt-4 rounded-md border border-slate-700 bg-slate-900/40 p-3">
          <h4 className="text-xs font-semibold tracking-wide text-slate-200 uppercase">
            {DATASET_INDICATORS_HEADING}
          </h4>
          <p className="mt-1 text-xs text-slate-400">{DATASET_INDICATORS_LEAD}</p>
          <dl className="mt-3 grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
            {verificationIndicators.map((entry) => (
              <div key={`indicator-${entry.key}`} className="contents">
                <dt className="font-mono text-xs break-words text-slate-400">{entry.key}</dt>
                <dd className="min-w-0 break-words text-slate-100">
                  <code className={codeClass}>{entry.value}</code>
                </dd>
                <dd className="min-w-0 text-xs break-words text-slate-400">
                  {OFFICIAL_VERIFICATION_INDICATORS[entry.key]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </>
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
  osmRef,
  officialProperties,
  acceptedRegionalSchluessel,
  sourceKind,
}: {
  osmRef: ParsedReportRowOsmRef
  officialProperties: Record<string, unknown>
  acceptedRegionalSchluessel?: string | null
  sourceKind: SourceKind | undefined
}) {
  const live = useOverpassRelationTags(String(osmRef.numericId))
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
    <ProvenanceGridRow
      asDl
      surfaceClassName="bg-red-950/18"
      leftColumnClassName="flex flex-col gap-1"
      rightColumnClassName="mt-2"
      title={
        <span className="text-sm/6 font-medium text-slate-200">
          {de.feature.datasetOsmLiveCardTitle}
        </span>
      }
      titleAside={
        captionText ? <p className="text-xs leading-normal text-slate-400">{captionText}</p> : null
      }
    >
      {live.status === 'idle' && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void live.run()} className={sharedButtonClass}>
              {de.feature.datasetOsmLiveButton}
            </button>
            <span className="text-xs text-slate-400">
              {de.feature.datasetOsmLiveButtonHint(osmRef.numericId)}
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <InformationCircleIcon aria-hidden="true" className="size-4 shrink-0 text-sky-300" />
            <span>
              {renderWithAbbr(
                de.feature.datasetOsmLiveCompareHint(sourceText(sourceKind, 'dataHeading')),
              )}
            </span>
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
              acceptedRegionalSchluessel={acceptedRegionalSchluessel}
              sourceKind={sourceKind}
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
    </ProvenanceGridRow>
  )
}

const candidateKeyOf = (candidate: CandidateMatch) => `${candidate.osmType}/${candidate.osmId}`

export function FeatureDatasetProperties({
  row,
  data,
  featureKey,
  candidates,
  hints,
  wikidata,
  osmTagsLiveOnly = false,
}: {
  row: ReportRow
  data: ComparisonForReport
  /** Key of the detail page (shared by the live OSM loads of the page). */
  featureKey: string
  /** Protected-area candidates (shard); only candidates with `tags` can be shown. */
  candidates?: CandidateMatch[]
  /** Matched rows: shard `attributeHints`; the ones no attribute check covers show as chips. */
  hints?: AttributeHint[]
  /** Wikidata items of the record (shard); the "Wikidata" block shows only when present. */
  wikidata?: WikidataShard
  /** Compare page: the row has no OSM tags of the extract, so checks run on live tags only. */
  osmTagsLiveOnly?: boolean
}) {
  const [candidateKey, setCandidateKey] = useState('')
  const taggedCandidates = (candidates ?? []).filter((candidate) => candidate.tags !== undefined)
  const selectedCandidate =
    taggedCandidates.find((candidate) => candidateKeyOf(candidate) === candidateKey) ?? null
  const official = forDisplayOfficial(row.officialProperties)
  const osm = forDisplay(row.osmProperties)
  const shownOsmTags = selectedCandidate?.tags ?? osm
  // Checks need an OSM side: none for OSM-only rows, and official-only rows get one by selecting a
  // candidate (`evaluateAttributeChecks` returns nothing without OSM tags).
  const attributeCheckResults =
    row.category === 'unmatched_osm' || osmTagsLiveOnly
      ? []
      : evaluateAttributeChecks(data.attributeChecks, official, shownOsmTags)

  const osmResolved = buildResolvedOsmSourceSide(data.sourceMetadata?.osm)
  const osmPick = pickOsmDatasetExtractDate(osmResolved)
  const osmDataNote =
    osmPick.checkedAtRaw && !osmPick.snapshotFromPbfHeader
      ? de.feature.datasetExtractOsmUncertainNote
      : null
  const osmTagMarkers = liveOsmTagMarkers(attributeCheckResults, official, data.sourceKind)
  const chipHints =
    row.category === 'matched' ? (hints ?? []).filter((hint) => hint.id === 'osm_ref_differs') : []
  const osmRef = parseReportRowOsmRef(row.osmRelationId)
  // Protected-area datasets (with attribute checks) load the matched object by id; admin datasets
  // keep the relation tag lookup below.
  const liveObject =
    (row.category === 'matched' || osmTagsLiveOnly) && (data.attributeChecks?.length ?? 0) > 0
      ? parseLiveOsmObjectRef(row.osmRelationId)
      : null
  const liveContext: LiveOsmContext = { featureKey, row, data }
  const officialAreaM2 =
    row.metrics && row.metrics.officialAreaM2 > 0
      ? { official: row.metrics.officialAreaM2, osm: row.metrics.osmAreaM2 }
      : null
  const osmHistoryUrl =
    osmRef == null ? null : `https://www.openstreetmap.org/relation/${osmRef.numericId}/history`
  const compactButtonClass =
    'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm ring-1 ring-inset transition-colors bg-slate-100 text-slate-900 ring-slate-300 hover:bg-slate-200'

  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={de.feature.datasetPropertiesSectionAria}
    >
      <ProvenanceGridSectionHeader title={de.feature.datasetPropertiesSectionTitle} />
      <div className="border-t border-slate-700">
        <AttributeCheckSummary
          results={attributeCheckResults}
          hints={chipHints}
          sourceKind={data.sourceKind}
        />
        <dl className="divide-y divide-slate-700/80">
          <ProvenanceGridRow
            asDl
            surfaceClassName="bg-blue-950/18"
            leftColumnClassName="flex flex-col gap-1"
            rightColumnClassName="mt-2"
            title={
              <span className="text-sm/6 font-medium text-slate-200">
                <SourceTerm kind={data.sourceKind} term="dataFilteredHeading" />
              </span>
            }
            titleAside={<OfficialDatasetAgeInfoLink side={data.sourceMetadata?.official} />}
          >
            <DatasetPropertyCard
              properties={official}
              checkResults={attributeCheckResults}
              sourceKind={data.sourceKind}
            />
          </ProvenanceGridRow>
          <ProvenanceGridRow
            asDl
            surfaceClassName="bg-red-950/18"
            leftColumnClassName="flex flex-col gap-2"
            rightColumnClassName="mt-2"
            title={
              <h3 className="text-sm/6 font-medium text-slate-200">
                {de.feature.datasetOsmCardTitle}
              </h3>
            }
            titleAside={
              <>
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
                {osmHistoryUrl ? (
                  <a
                    href={osmHistoryUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`${compactButtonClass} self-start`}
                  >
                    {de.feature.datasetOsmOpenHistory}
                  </a>
                ) : null}
                {liveObject ? (
                  <LiveOsmObjectLoadButton
                    context={liveContext}
                    object={liveObject}
                    idleLabel={de.feature.liveOsmMatchedLoad}
                    className={`${compactButtonClass} self-start disabled:pointer-events-none disabled:opacity-50`}
                  />
                ) : null}
              </>
            }
          >
            {taggedCandidates.length > 0 ? (
              <div className="flex flex-col gap-1">
                <label htmlFor="feature-osm-candidate" className="text-xs text-slate-400">
                  {de.feature.datasetOsmCandidateSelectLabel}
                </label>
                <select
                  id="feature-osm-candidate"
                  value={candidateKey}
                  onChange={(e) => setCandidateKey(e.target.value)}
                  className="block w-full max-w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 shadow-sm focus:border-sky-600 focus:ring-1 focus:ring-sky-600/30 focus:outline-none"
                >
                  <option value="">{de.feature.datasetPropertiesEmpty}</option>
                  {taggedCandidates.map((candidate) => (
                    <option key={candidateKeyOf(candidate)} value={candidateKeyOf(candidate)}>
                      {`${candidate.name ?? de.feature.candidatesNoName} (${candidateKeyOf(candidate)})`}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {selectedCandidate ? (
              <p className="text-xs text-slate-400">{de.feature.datasetOsmCandidateTagsLabel}</p>
            ) : null}
            <DatasetPropertyCard
              properties={shownOsmTags}
              osmTagMarkers={osmTagMarkers}
              sourceKind={data.sourceKind}
              emptyText={de.feature.datasetOsmNone}
            />
            {liveObject ? (
              <div className="mt-4 border-t border-slate-700/80 pt-3 empty:hidden">
                <LiveOsmObjectResult
                  context={liveContext}
                  object={liveObject}
                  {...(osmTagsLiveOnly
                    ? { notLoadedHint: de.compare.osmTagsNotLoadedHint }
                    : { snapshotTags: osm })}
                />
              </div>
            ) : null}
          </ProvenanceGridRow>
          {wikidata ? (
            <WikidataAttributesRow
              wikidata={wikidata}
              official={official}
              osm={osm}
              osmRelationId={row.osmRelationId}
              areaM2={officialAreaM2}
              sourceKind={data.sourceKind}
            />
          ) : null}
          {osmRef != null && liveObject == null && (
            <OsmLiveRelationTagsRow
              osmRef={osmRef}
              officialProperties={official}
              acceptedRegionalSchluessel={row.staleOfficialKey?.toArs}
              sourceKind={data.sourceKind}
            />
          )}
        </dl>
      </div>
    </section>
  )
}
