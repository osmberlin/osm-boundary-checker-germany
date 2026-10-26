import { Link } from '@tanstack/react-router'
import { DTP_KEYLESS_MATCH_KEY_PREFIX } from '../../../../scripts/shared/dtpOfficial.ts'
import {
  categoryIdFromOfficialProperties,
  protectedAreaCategoryRule,
} from '../../../../scripts/shared/protectedAreaCategories.ts'
import { areasIndex } from '../../data/areasIndex'
import { de } from '../../i18n/de'
import { isGermanKeyExplorerDisplayKey } from '../../lib/germanKeyExplorer'
import { withSiteBasePath } from '../../lib/siteBasePath'
import type {
  CandidateMatch,
  ComparisonFilterConfigSummary,
  ComparisonForReport,
  OverpassBoundaryTag,
  ReportRow,
} from '../../types/report'
import { ProvenanceGridSectionHeader } from '../ProvenanceGridSectionHeader'
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

/** Same resolver as Live-OSM treffer (`LiveSourceProperties`). */
function relationResolverHref(areaKey: string, relationId: string): string {
  const query = new URLSearchParams()
  const dataset = areaKey.trim()
  if (dataset.length > 0) query.set('dataset', dataset)
  const search = query.toString()
  return withSiteBasePath(
    `/resolve/relation/${encodeURIComponent(relationId)}${search ? `?${search}` : ''}`,
  )
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
  // DtP areas without a WDPA id have no ref:WDPA to expect; the tag of the osm_tag rule links them.
  const identityTags = (data.matchRules ?? []).flatMap((rule) =>
    rule.kind === 'osm_tag' ? [rule.osmTag] : [],
  )
  const keylessDtpId = keylessDtpIdOf(row)
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
            {key}={value}
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
}

function CandidateRow({ candidate, isPostalCodeProfile, areaKey }: CandidateRowProps) {
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
      <span className="flex shrink-0 gap-x-3 text-xs">
        <a href={osmObjectUrl(candidate)} className={linkClass} target="_blank" rel="noreferrer">
          {de.feature.candidatesViewLink}
        </a>
        <a href={osmEditUrl(candidate)} className={linkClass} target="_blank" rel="noreferrer">
          {de.feature.candidatesEditLink}
        </a>
      </span>
    </div>
  )
}

/**
 * Renders the additive "OSM-Matching-Kandidaten" list for `official_only` rows. Candidate data
 * is shipped only in the per-feature shard (`output/features/<key>.json`) so the main
 * comparison table stays slim. A row without candidates (`candidates` undefined or empty) still
 * shows the expected OSM tags in the empty state.
 *
 * The section deliberately stays read-only in v1: a future iteration can add an "Auf
 * Karte zeigen" button that fetches the candidate polygons via Overpass-by-id.
 */
export function OfficialOnlyCandidatesSection({
  areaKey,
  row,
  candidates,
  data,
}: {
  areaKey: string
  row: ReportRow
  candidates: CandidateMatch[] | undefined
  data: ComparisonForReport
}) {
  if (row.category !== 'official_only') return null
  const list = candidates ?? []

  if (data.overpassBoundaryTag === 'protected_area') {
    return (
      <ProtectedAreaCandidatesSection areaKey={areaKey} row={row} data={data} candidates={list} />
    )
  }

  const { filterConfigSummary, overpassBoundaryTag } = data
  const isPostalCodeProfile = list.some((candidate) => candidate.postalCodeRaw !== undefined)
  const boundaryMode = boundaryModeFromData(overpassBoundaryTag)
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
      <div className="border-t border-sky-800/45 px-4 py-6 sm:px-6">
        {list.length === 0 ? (
          <NoCandidatesNotice areaKey={areaKey} row={row} data={data} />
        ) : (
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
              />
            ))}
          </div>
        )}
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
}: {
  areaKey: string
  row: ReportRow
  data: ComparisonForReport
  candidates: CandidateMatch[]
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
      <div className="border-t border-sky-800/45 px-4 py-6 sm:px-6">
        {candidates.length === 0 ? (
          <NoCandidatesNotice areaKey={areaKey} row={row} data={data} />
        ) : (
          <ProtectedAreaCandidatesList candidates={candidates} />
        )}
      </div>
    </section>
  )
}
