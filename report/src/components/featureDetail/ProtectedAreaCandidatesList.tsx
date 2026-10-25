import { de } from '../../i18n/de'
import type { CandidateMatch, CandidateSignalId } from '../../types/report'
import { CopyTagsButton } from './CopyTagsButton'

const LINK_CLASS =
  'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

const SIGNAL_BADGE_CLASS: Record<CandidateSignalId, string> = {
  dtp_id: 'bg-emerald-900/60 text-emerald-200 ring-emerald-700/60',
  dtp_osm_ref: 'bg-emerald-900/60 text-emerald-200 ring-emerald-700/60',
  wikidata: 'bg-sky-900/60 text-sky-200 ring-sky-700/60',
  natura2000: 'bg-sky-900/60 text-sky-200 ring-sky-700/60',
  inside: 'bg-slate-800 text-slate-200 ring-slate-600',
  name: 'bg-amber-900/50 text-amber-200 ring-amber-700/60',
}

function osmObjectUrl(candidate: CandidateMatch): string {
  return `https://www.openstreetmap.org/${candidate.osmType}/${candidate.osmId}`
}

function osmEditUrl(candidate: CandidateMatch): string {
  return `https://www.openstreetmap.org/edit?${candidate.osmType}=${candidate.osmId}`
}

function currentTypeTags(candidate: CandidateMatch): string[] {
  const out: string[] = []
  if (candidate.protectClass) out.push(`protect_class=${candidate.protectClass}`)
  if (candidate.protectionTitle) out.push(`protection_title=${candidate.protectionTitle}`)
  if (candidate.wikidata) out.push(`wikidata=${candidate.wikidata}`)
  if (candidate.refWdpa) out.push(`ref:WDPA=${candidate.refWdpa}`)
  return out
}

function ProtectedAreaCandidateRow({ candidate }: { candidate: CandidateMatch }) {
  const objectLabel = `${candidate.osmType}/${candidate.osmId}`
  const displayName =
    candidate.name == null || candidate.name.length === 0
      ? de.feature.candidatesNoName
      : candidate.name
  const signals = candidate.signals ?? []
  const current = currentTypeTags(candidate)
  const suggested = candidate.suggestedTags ?? {}
  const similarity = candidate.nameSimilarity

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="break-words text-slate-100">{displayName}</p>
          <p className="font-mono text-xs break-words text-slate-400">
            <a
              href={osmObjectUrl(candidate)}
              className={LINK_CLASS}
              target="_blank"
              rel="noreferrer"
            >
              {objectLabel}
            </a>
            {similarity !== undefined ? (
              <span className="ml-2 font-sans">
                {de.feature.protectedCandidatesNameSimilarity(Math.round(similarity * 100))}
              </span>
            ) : null}
          </p>
        </div>
        <span className="flex shrink-0 gap-x-3 text-xs">
          <a href={osmObjectUrl(candidate)} className={LINK_CLASS} target="_blank" rel="noreferrer">
            {de.feature.candidatesViewLink}
          </a>
          <a href={osmEditUrl(candidate)} className={LINK_CLASS} target="_blank" rel="noreferrer">
            {de.feature.candidatesEditLink}
          </a>
        </span>
      </div>

      <ul
        className="flex flex-wrap gap-1.5"
        aria-label={de.feature.protectedCandidatesColumnSignals}
      >
        {signals.map((signal) => (
          <li
            key={signal}
            title={de.feature.protectedCandidatesSignalTitle[signal]}
            className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${SIGNAL_BADGE_CLASS[signal]}`}
          >
            {de.feature.protectedCandidatesSignal[signal]}
          </li>
        ))}
      </ul>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            {de.feature.protectedCandidatesColumnCurrent}
          </dt>
          <dd className="font-mono text-xs break-words text-slate-100">
            {current.length > 0
              ? current.map((tag) => <div key={tag}>{tag}</div>)
              : de.feature.protectedCandidatesCurrentNone}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-400 uppercase">
            {de.feature.protectedCandidatesColumnSuggested}
            <CopyTagsButton tags={suggested} ariaLabel={de.feature.copyTagsAria(objectLabel)} />
          </dt>
          <dd className="font-mono text-xs break-words text-slate-100">
            {Object.entries(suggested).map(([key, value]) => (
              <div key={key}>
                {key}={value}
              </div>
            ))}
          </dd>
        </div>
      </dl>
    </li>
  )
}

export function ProtectedAreaCandidatesList({ candidates }: { candidates: CandidateMatch[] }) {
  return (
    <ul className="divide-y divide-sky-800/45">
      {candidates.map((candidate) => (
        <ProtectedAreaCandidateRow
          key={`${candidate.osmType}/${candidate.osmId}`}
          candidate={candidate}
        />
      ))}
    </ul>
  )
}
