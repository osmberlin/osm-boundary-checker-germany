import { de } from '../../i18n/de'
import type { CandidateMatch, ReportRow } from '../../types/report'

const CANDIDATE_LIST_GRID =
  'grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm'

function osmObjectUrl(candidate: CandidateMatch): string {
  return `https://www.openstreetmap.org/${candidate.osmType}/${candidate.osmId}`
}

function osmEditUrl(candidate: CandidateMatch): string {
  return `https://www.openstreetmap.org/edit?${candidate.osmType}=${candidate.osmId}`
}

function emptyValue(value: string | null | undefined): string {
  if (value == null) return de.feature.candidatesEmptyValue
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : de.feature.candidatesEmptyValue
}

function CandidateRow({
  candidate,
  isPostalCodeProfile,
}: {
  candidate: CandidateMatch
  isPostalCodeProfile: boolean
}) {
  const objectLabel = `${candidate.osmType}/${candidate.osmId}`
  const displayName =
    candidate.name == null || candidate.name.length === 0
      ? de.feature.candidatesNoName
      : candidate.name
  const linkClass =
    'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

  return (
    <div className="contents">
      <span className="min-w-0 font-mono text-xs break-words text-slate-100">
        <a href={osmObjectUrl(candidate)} className={linkClass} target="_blank" rel="noreferrer">
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
          <span className="min-w-0 font-mono text-xs break-words text-slate-100">
            {emptyValue(candidate.deAgsRaw)}
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
 * Renders the additive "OSM-Kandidaten" list for `official_only` rows. Candidate data
 * is shipped only in the per-feature shard (`output/features/<key>.json`) so the main
 * comparison table stays slim — this component is therefore expected to be invoked with
 * `candidates !== undefined` only on detail pages where the shard was successfully loaded.
 *
 * The section deliberately stays read-only in v1: a future iteration can add an "Auf
 * Karte zeigen" button that fetches the candidate polygons via Overpass-by-id.
 */
export function OfficialOnlyCandidatesSection({
  row,
  candidates,
}: {
  row: ReportRow
  candidates: CandidateMatch[] | undefined
}) {
  if (row.category !== 'official_only') return null
  if (candidates === undefined) return null

  const isPostalCodeProfile = candidates.some((candidate) => candidate.postalCodeRaw !== undefined)

  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={de.feature.candidatesSectionAria}
    >
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">
          {de.feature.candidatesSectionTitle}
        </h2>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">{de.feature.candidatesSectionLead}</p>
      </div>
      <div className="border-t border-slate-700 px-4 py-6 sm:px-6">
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
              {isPostalCodeProfile ? '' : de.feature.candidatesColumnDeAgs}
            </span>
            <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
              {de.feature.candidatesColumnActions}
            </span>
            {candidates.map((candidate) => (
              <CandidateRow
                key={`${candidate.osmType}/${candidate.osmId}`}
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
