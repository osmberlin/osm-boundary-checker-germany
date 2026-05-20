import { de } from '../../i18n/de'
import { withSiteBasePath } from '../../lib/siteBasePath'
import type {
  CandidateMatch,
  ComparisonFilterConfigSummary,
  OverpassBoundaryTag,
  ReportRow,
} from '../../types/report'
import { ProvenanceGridSectionHeader } from '../ProvenanceGridSectionHeader'

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

function CandidateRow({
  candidate,
  isPostalCodeProfile,
  areaKey,
}: {
  candidate: CandidateMatch
  isPostalCodeProfile: boolean
  areaKey: string
}) {
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
 * comparison table stays slim — this component is therefore expected to be invoked with
 * `candidates !== undefined` only on detail pages where the shard was successfully loaded.
 *
 * The section deliberately stays read-only in v1: a future iteration can add an "Auf
 * Karte zeigen" button that fetches the candidate polygons via Overpass-by-id.
 */
export function OfficialOnlyCandidatesSection({
  areaKey,
  row,
  candidates,
  filterConfigSummary,
  overpassBoundaryTag,
}: {
  areaKey: string
  row: ReportRow
  candidates: CandidateMatch[] | undefined
  filterConfigSummary: ComparisonFilterConfigSummary
  overpassBoundaryTag: OverpassBoundaryTag | undefined
}) {
  if (row.category !== 'official_only') return null
  if (candidates === undefined) return null

  const isPostalCodeProfile = candidates.some((candidate) => candidate.postalCodeRaw !== undefined)
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
        {showMatchHint ? (
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
        {candidates.length === 0 ? (
          <p className="text-sm text-slate-400">{de.feature.candidatesEmpty}</p>
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
            {candidates.map((candidate) => (
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
