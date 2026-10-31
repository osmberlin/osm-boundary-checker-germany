import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { DTP_KEYLESS_MATCH_KEY_PREFIX } from '../../../../scripts/shared/dtpOfficial.ts'
import {
  categoryIdFromOfficialProperties,
  protectedAreaCategoryRule,
} from '../../../../scripts/shared/protectedAreaCategories.ts'
import { areasIndex } from '../../data/areasIndex'
import { useLiveOsmMapRowKeys } from '../../hooks/useLiveOsmMapRowKeys'
import { de } from '../../i18n/de'
import { unmatchedOsmKeyForObject } from '../../lib/compareRows'
import { isGermanKeyExplorerDisplayKey } from '../../lib/germanKeyExplorer'
import { nearbyCandidates } from '../../lib/nearbyCandidates'
import { relationResolverHref } from '../../lib/relationResolverLink'
import type {
  CandidateMatch,
  ComparisonFilterConfigSummary,
  ComparisonForReport,
  OverpassBoundaryTag,
  ReportRow,
} from '../../types/report'
import { CandidateCompareLink } from '../compare/CandidateCompareLink'
import { LiveSectionVisibilityToggle } from '../LiveSourceProperties'
import { ProvenanceGridSectionHeader } from '../ProvenanceGridSectionHeader'
import { sharedButtonTinyClass } from '../sharedButtonStyles'
import { TagValue } from '../TagValue'
import {
  LiveOsmObjectLoadButton,
  LiveOsmObjectResult,
  NearbyOsmObjectTags,
  type LiveOsmContext,
} from './LiveOsmObject'
import { NearbyOsmSearch, type NearbyOsmSearchState } from './NearbyOsmSearch'
import { ProtectedAreaCandidatesList } from './ProtectedAreaCandidatesList'

type ExpectedTag = { key: string; value: string }

function boundaryModeFromData(
  overpassBoundaryTag: OverpassBoundaryTag | undefined,
): 'postal_code' | 'administrative' {
  return overpassBoundaryTag === 'postal_code' ? 'postal_code' : 'administrative'
}

function osmMatchTagsJoinedForProse(
  filter: ComparisonFilterConfigSummary,
  boundaryMode: 'postal_code' | 'administrative',
): string {
  const list = filter.osmMatchProperties?.map((s) => s.trim()).filter((s) => s.length > 0) ?? []
  if (list.length > 0) return list.join('“, „')
  return boundaryMode === 'postal_code' ? 'postal_code' : 'de:regionalschluessel'
}

function officialMatchPropertyOrPlaceholder(filter: ComparisonFilterConfigSummary): string {
  const v = filter.officialMatchProperty?.trim()
  return v != null && v.length > 0 ? v : '–'
}

function adminLevelsSortedCsv(filter: ComparisonFilterConfigSummary): string {
  const raw = filter.adminLevels?.map((s) => s.trim()).filter((s) => s.length > 0) ?? []
  if (raw.length === 0) return ''
  return [...raw].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ')
}

const CANDIDATE_LIST_GRID =
  'grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm'

function osmObjectUrl(candidate: CandidateMatch): string {
  return `https://www.openstreetmap.org/${candidate.osmType}/${candidate.osmId}`
}

function osmEditUrl(candidate: CandidateMatch): string {
  return `https://www.openstreetmap.org/edit?${candidate.osmType}=${candidate.osmId}`
}

function candidateObjectHref(candidate: CandidateMatch, areaKey: string): string {
  if (candidate.osmType === 'relation') return relationResolverHref(areaKey, candidate.osmId)
  return osmObjectUrl(candidate)
}

function emptyValue(value: string | null | undefined): string {
  if (value == null) return de.feature.candidatesEmptyValue
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : de.feature.candidatesEmptyValue
}

/** `dtp-<uuid>` of a DtP area without WDPA id, or null for rows keyed by their WDPA id. */
function keylessDtpIdOf(row: ReportRow): string | null {
  return row.canonicalMatchKey.startsWith(DTP_KEYLESS_MATCH_KEY_PREFIX)
    ? row.canonicalMatchKey.slice(DTP_KEYLESS_MATCH_KEY_PREFIX.length)
    : null
}

/** Administrative and postal-code rows: boundary, admin levels and the match tag with the row's key. */
function administrativeExpectedTags(
  areaKey: string,
  row: ReportRow,
  data: ComparisonForReport,
): ExpectedTag[] {
  const summary = areasIndex.summaries.find((s) => s.area === areaKey)
  const adminLevels = summary?.osmAdminLevels ?? data.filterConfigSummary.adminLevels
  const keylessDtpId = keylessDtpIdOf(row)
  // DtP areas without a WDPA id have no ref:WDPA to expect; the tag of the osm_tag rule whose official
  // value is the DtP UUID links them. Other osm_tag rules (such as wikidata) do not name that key.
  const identityTags = (data.matchRules ?? []).flatMap((rule) =>
    rule.kind === 'osm_tag' &&
    keylessDtpId !== null &&
    String(row.officialProperties?.[rule.officialProperty] ?? '')
      .trim()
      .toLowerCase() === keylessDtpId
      ? [rule.osmTag]
      : [],
  )
  const matchProperties =
    keylessDtpId && identityTags.length > 0
      ? identityTags
      : (data.filterConfigSummary.osmMatchProperties
          ?.map((x) => x.trim())
          .filter((x) => x.length > 0) ??
        summary?.osmMatchProperties?.map((x) => x.trim()).filter((x) => x.length > 0) ??
        [])
  const matchValue = keylessDtpId ?? row.canonicalMatchKey
  return [
    { key: 'boundary', value: data.overpassBoundaryTag ?? 'administrative' },
    ...(adminLevels ?? []).map((level) => ({ key: 'admin_level', value: level })),
    ...matchProperties.map((key) => ({ key, value: matchValue })),
  ]
}

/** DtP rows: the tags of the row's category, plus its WDPA key and wikidata when present. */
function protectedAreaExpectedTags(row: ReportRow): ExpectedTag[] | null {
  const rule = protectedAreaCategoryRule(categoryIdFromOfficialProperties(row.officialProperties))
  if (!rule) return null
  const tags: ExpectedTag[] = Object.entries(rule.expectedTags).map(([key, value]) => ({
    key,
    value,
  }))
  const wdpa = keylessDtpIdOf(row) === null ? row.canonicalMatchKey.trim() : ''
  if (wdpa.length > 0) tags.push({ key: 'ref:WDPA', value: wdpa })
  const wikidata = String(row.officialProperties?.wikidata ?? '').trim()
  if (wikidata.length > 0) tags.push({ key: 'wikidata', value: wikidata })
  return tags
}

function expectedOsmTags(
  areaKey: string,
  row: ReportRow,
  data: ComparisonForReport,
): ExpectedTag[] {
  // A stale official key must not be written to OSM, so there is no tag set to suggest.
  if (row.staleOfficialKey) return []
  if (data.overpassBoundaryTag === 'protected_area') {
    const protectedTags = protectedAreaExpectedTags(row)
    if (protectedTags) return protectedTags
  }
  return administrativeExpectedTags(areaKey, row, data)
}

/** Empty state of the candidate lists: says which tags a matching OSM object should carry. */
function NoCandidatesNotice({
  areaKey,
  row,
  data,
}: {
  areaKey: string
  row: ReportRow
  data: ComparisonForReport
}) {
  const tags = expectedOsmTags(areaKey, row, data)
  if (tags.length === 0) {
    return <p className="text-sm text-slate-400">{de.feature.candidatesEmpty}</p>
  }
  const showKeyExplorer = tags.some(({ key }) => isGermanKeyExplorerDisplayKey(key))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-400">
        {de.feature.candidatesEmpty} {de.feature.candidatesExpectedTagsLead}
      </p>
      <code className="self-start rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-xs break-all text-slate-200 ring-1 ring-slate-700/80">
        {tags.map(({ key, value }) => (
          <span key={`${key}=${value}`} className="block">
            {key}={<TagValue tagKey={key} value={value} />}
          </span>
        ))}
      </code>
      {showKeyExplorer ? (
        <p className="text-sm">
          <Link
            to="/tools/german-key"
            search={{ key: row.canonicalMatchKey }}
            className="font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
          >
            {de.feature.decodeKeyExplorerLink}
          </Link>
        </p>
      ) : null}
    </div>
  )
}

type CandidateRowProps = {
  candidate: CandidateMatch
  isPostalCodeProfile: boolean
  areaKey: string
  context: LiveOsmContext
  /** Unmatched OSM row of this candidate, for the compare link. */
  compareOsmKey: string | null
  /** Found by the nearby search: its tags are live already, so there is nothing to load. */
  nearby?: boolean
}

function CandidateRow({
  candidate,
  isPostalCodeProfile,
  areaKey,
  context,
  compareOsmKey,
  nearby = false,
}: CandidateRowProps) {
  const objectLabel = `${candidate.osmType}/${candidate.osmId}`
  const displayName =
    candidate.name == null || candidate.name.length === 0
      ? de.feature.candidatesNoName
      : candidate.name
  const linkClass =
    'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'
  const objectHref = candidateObjectHref(candidate, areaKey)
  const objectLinkIsInternal = candidate.osmType === 'relation'
  const objectLinkAria = objectLinkIsInternal
    ? de.feature.liveOsmHitOpenBoundaryCheckerAria(candidate.osmType, Number(candidate.osmId))
    : de.feature.liveOsmHitOpenLinkAria(candidate.osmType, Number(candidate.osmId))
  const liveObject = { type: candidate.osmType, id: Number(candidate.osmId) }

  return (
    <div className="contents">
      <span className="min-w-0 font-mono text-xs break-words text-slate-100">
        <a
          href={objectHref}
          className={linkClass}
          {...(objectLinkIsInternal
            ? {}
            : { target: '_blank' as const, rel: 'noreferrer' as const })}
          aria-label={objectLinkAria}
        >
          {objectLabel}
        </a>
        {nearby ? (
          <span className="mt-1 block font-sans text-xs text-slate-400">
            {de.feature.liveOsmNearbyBadge}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 break-words text-slate-100">{displayName}</span>
      {isPostalCodeProfile ? (
        <>
          <span className="min-w-0 font-mono text-xs break-words text-slate-100">
            {emptyValue(candidate.postalCodeRaw)}
          </span>
          <span className="font-mono text-xs text-slate-500">
            {de.feature.candidatesEmptyValue}
          </span>
        </>
      ) : (
        <>
          <span className="min-w-0 font-mono text-xs break-words text-slate-100">
            {emptyValue(candidate.adminLevel)}
          </span>
          <span className="min-w-0 font-mono text-xs break-words text-slate-100">
            {emptyValue(candidate.deRegionalRaw)}
          </span>
        </>
      )}
      <span className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <a href={osmObjectUrl(candidate)} className={linkClass} target="_blank" rel="noreferrer">
          {de.feature.candidatesViewLink}
        </a>
        <a href={osmEditUrl(candidate)} className={linkClass} target="_blank" rel="noreferrer">
          {de.feature.candidatesEditLink}
        </a>
        <CandidateCompareLink
          areaKey={areaKey}
          officialKey={context.row.canonicalMatchKey}
          osmKey={compareOsmKey}
          className={linkClass}
        />
        {nearby ? null : (
          <LiveOsmObjectLoadButton
            context={context}
            object={liveObject}
            className={sharedButtonTinyClass}
          />
        )}
      </span>
      <div className="col-span-full pb-3 empty:hidden">
        {nearby ? (
          <NearbyOsmObjectTags
            type={liveObject.type}
            id={liveObject.id}
            tags={candidate.tags ?? {}}
            context={context}
          />
        ) : (
          <LiveOsmObjectResult context={context} object={liveObject} />
        )}
      </div>
    </div>
  )
}

/** "Alle ausblenden / einblenden" for the Postpass objects of the candidate lists on the map. */
function CandidatesMapVisibilityToggle({ featureKey }: { featureKey: string }) {
  const rowKeys = useLiveOsmMapRowKeys(featureKey)
  if (rowKeys.length < 2) return null
  return <LiveSectionVisibilityToggle featureKey={featureKey} rowKeys={rowKeys} />
}

/** Live OSM data around the candidate lists: the nearby bbox search and the map viewport it uses. */
export type CandidatesLiveSources = {
  featureKey: string
  nearbySearch: NearbyOsmSearchState
  getLiveQueryBbox: () => [number, number, number, number] | null
}

/**
 * Renders the additive "OSM-Matching-Kandidaten" list for `official_only` rows. Candidate data
 * is shipped only in the per-feature shard (`output/features/<key>.json`) so the main
 * comparison table stays slim. A row without candidates (`candidates` undefined or empty) still
 * shows the expected OSM tags in the empty state.
 *
 * Each candidate can load its current OSM state (Postpass by id); the last entry searches the
 * map viewport for further OSM objects, which then appear as additional entries.
 */
export function OfficialOnlyCandidatesSection({
  areaKey,
  row,
  candidates,
  data,
  comparison,
  live,
}: {
  areaKey: string
  row: ReportRow
  candidates: CandidateMatch[] | undefined
  data: ComparisonForReport
  /**
   * Full comparison table (with `unmatchedOsm`): candidates found there link to a comparison.
   * Undefined while it loads; the links appear once it is there.
   */
  comparison: ComparisonForReport | undefined
  live: CandidatesLiveSources
}) {
  if (row.category !== 'official_only') return null
  const list = candidates ?? []
  const nearby = nearbyCandidates(live.nearbySearch.hits, list)
  const context: LiveOsmContext = { featureKey: live.featureKey, row, data }
  const compareOsmKeyOf = (candidate: CandidateMatch) =>
    comparison ? unmatchedOsmKeyForObject(comparison, candidate.osmType, candidate.osmId) : null
  const nearbySearch = (
    <>
      <CandidatesMapVisibilityToggle featureKey={live.featureKey} />
      <NearbyOsmSearch
        search={live.nearbySearch}
        getLiveQueryBbox={live.getLiveQueryBbox}
        overpassBoundaryTag={data.overpassBoundaryTag ?? 'administrative'}
        entryCount={nearby.length}
      />
    </>
  )

  if (data.overpassBoundaryTag === 'protected_area') {
    return (
      <ProtectedAreaCandidatesSection
        areaKey={areaKey}
        row={row}
        data={data}
        candidates={list}
        nearby={nearby}
        context={context}
        compareOsmKeyOf={compareOsmKeyOf}
        nearbySearch={nearbySearch}
      />
    )
  }

  const { filterConfigSummary, overpassBoundaryTag } = data
  const boundaryMode = boundaryModeFromData(overpassBoundaryTag)
  const isPostalCodeProfile =
    boundaryMode === 'postal_code' ||
    list.some((candidate) => candidate.postalCodeRaw !== undefined)
  const osmTagsJoined = osmMatchTagsJoinedForProse(filterConfigSummary, boundaryMode)
  const officialProp = officialMatchPropertyOrPlaceholder(filterConfigSummary)
  const leadChecks =
    boundaryMode === 'postal_code'
      ? de.feature.candidatesSectionLeadChecksPostal()
      : (() => {
          const levelsCsv = adminLevelsSortedCsv(filterConfigSummary)
          return levelsCsv.length > 0
            ? de.feature.candidatesSectionLeadChecksAdminListed(levelsCsv)
            : de.feature.candidatesSectionLeadChecksAdminGeneric()
        })()
  const matchTag =
    filterConfigSummary.osmMatchProperties?.[0]?.trim() ||
    (boundaryMode === 'postal_code' ? 'postal_code' : 'de:regionalschluessel')
  const matchKey = row.canonicalMatchKey?.trim() ?? ''
  const showMatchHint = matchKey.length > 0
  const matchHintBefore =
    boundaryMode === 'postal_code'
      ? de.feature.candidatesSectionMatchHintBeforePostal()
      : de.feature.candidatesSectionMatchHintBeforeAdmin()

  return (
    <section
      className="overflow-hidden rounded-lg border border-sky-800/50 bg-sky-950/45 shadow-sm"
      aria-label={de.feature.candidatesSectionAria}
    >
      <ProvenanceGridSectionHeader title={de.feature.candidatesSectionTitle}>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">
          {de.feature.candidatesSectionLeadCore(osmTagsJoined, officialProp)} {leadChecks}
        </p>
        {row.staleOfficialKey ? (
          <p className="mt-2 max-w-4xl text-sm text-slate-400">
            {de.feature.candidatesSectionStaleHint}
          </p>
        ) : showMatchHint ? (
          <p className="mt-2 max-w-4xl text-sm text-slate-400">
            {matchHintBefore}{' '}
            <code className="rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-xs break-all text-slate-200 ring-1 ring-slate-700/80">
              {matchTag}={matchKey}
            </code>{' '}
            {de.feature.candidatesSectionMatchHintAfter()}
          </p>
        ) : null}
      </ProvenanceGridSectionHeader>
      <div className="flex flex-col gap-6 border-t border-sky-800/45 px-4 py-6 sm:px-6">
        {list.length === 0 ? <NoCandidatesNotice areaKey={areaKey} row={row} data={data} /> : null}
        {list.length + nearby.length > 0 ? (
          <div className={CANDIDATE_LIST_GRID}>
            <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              {de.feature.candidatesColumnObject}
            </span>
            <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              {de.feature.candidatesColumnName}
            </span>
            <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              {isPostalCodeProfile
                ? de.feature.candidatesColumnPostalCode
                : de.feature.candidatesColumnAdminLevel}
            </span>
            <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              {isPostalCodeProfile ? '' : de.feature.candidatesColumnDeRs}
            </span>
            <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              {de.feature.candidatesColumnActions}
            </span>
            {list.map((candidate) => (
              <CandidateRow
                key={`${candidate.osmType}/${candidate.osmId}`}
                areaKey={areaKey}
                candidate={candidate}
                isPostalCodeProfile={isPostalCodeProfile}
                context={context}
                compareOsmKey={compareOsmKeyOf(candidate)}
              />
            ))}
            {nearby.map((candidate) => (
              <CandidateRow
                key={`nearby-${candidate.osmType}/${candidate.osmId}`}
                areaKey={areaKey}
                candidate={candidate}
                isPostalCodeProfile={isPostalCodeProfile}
                context={context}
                compareOsmKey={compareOsmKeyOf(candidate)}
                nearby
              />
            ))}
          </div>
        ) : null}
        {nearbySearch}
      </div>
    </section>
  )
}

/** Protected-area (DtP) variant: per-candidate signals and a call to add the suggested tags. */
function ProtectedAreaCandidatesSection({
  areaKey,
  row,
  data,
  candidates,
  nearby,
  context,
  compareOsmKeyOf,
  nearbySearch,
}: {
  areaKey: string
  row: ReportRow
  data: ComparisonForReport
  candidates: CandidateMatch[]
  nearby: CandidateMatch[]
  context: LiveOsmContext
  compareOsmKeyOf: (candidate: CandidateMatch) => string | null
  nearbySearch: ReactNode
}) {
  return (
    <section
      className="overflow-hidden rounded-lg border border-sky-800/50 bg-sky-950/45 shadow-sm"
      aria-label={de.feature.candidatesSectionAria}
    >
      <ProvenanceGridSectionHeader title={de.feature.candidatesSectionTitle}>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">
          {de.feature.protectedCandidatesLead}
        </p>
      </ProvenanceGridSectionHeader>
      <div className="flex flex-col gap-6 border-t border-sky-800/45 px-4 py-6 sm:px-6">
        {candidates.length === 0 ? (
          <NoCandidatesNotice areaKey={areaKey} row={row} data={data} />
        ) : null}
        {candidates.length + nearby.length > 0 ? (
          <ProtectedAreaCandidatesList
            candidates={candidates}
            nearby={nearby}
            areaKey={areaKey}
            context={context}
            compareOsmKeyOf={compareOsmKeyOf}
          />
        ) : null}
        {nearbySearch}
      </div>
    </section>
  )
}
