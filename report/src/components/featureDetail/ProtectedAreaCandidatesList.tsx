import { de } from '../../i18n/de'
import { relationResolverHref } from '../../lib/relationResolverLink'
import type { CandidateMatch, CandidateSignalId } from '../../types/report'
import { sharedButtonClass } from '../sharedButtonStyles'
import { TagPairText, TagValue } from '../TagValue'
import { Abbr } from '../ui/Abbr'
import { CopyTagsButton } from './CopyTagsButton'
import {
  LiveOsmObjectLoadButton,
  LiveOsmObjectResult,
  NearbyOsmObjectTags,
  type LiveOsmContext,
} from './LiveOsmObject'

const LINK_CLASS =
  'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

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

function signalTitle(signal: CandidateSignalId, similarity: number | undefined): string {
  if (signal === 'name' && similarity !== undefined) {
    return de.feature.protectedCandidatesSignalNameTitle(Math.round(similarity * 100))
  }
  return de.feature.protectedCandidatesSignalTitle[signal]
}

function ProtectedAreaCandidateRow({
  candidate,
  areaKey,
  context,
  nearby = false,
}: {
  candidate: CandidateMatch
  areaKey: string
  context: LiveOsmContext
  /** Found by the nearby search: its tags are live already, so there is nothing to load. */
  nearby?: boolean
}) {
  const liveObject = { type: candidate.osmType, id: Number(candidate.osmId) }
  const objectLabel = `${candidate.osmType}/${candidate.osmId}`
  const displayName =
    candidate.name == null || candidate.name.length === 0
      ? de.feature.candidatesNoName
      : candidate.name
  const signals = candidate.signals ?? []
  const current = currentTypeTags(candidate)
  const suggested = Object.entries(candidate.suggestedTags ?? {})

  return (
    <li className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="break-words text-slate-100">
          {displayName}{' '}
          <a
            href={osmObjectUrl(candidate)}
            className={`font-mono text-xs ${LINK_CLASS}`}
            target="_blank"
            rel="noreferrer"
          >
            {objectLabel}
          </a>
        </p>
        {nearby ? (
          <p className="mt-1 text-sm text-slate-400">{de.feature.liveOsmNearbyBadge}</p>
        ) : null}
        {signals.length > 0 ? (
          <p className="mt-1 text-sm text-slate-400">
            {de.feature.protectedCandidatesDetectedVia}{' '}
            {signals.map((signal, index) => (
              <span key={signal}>
                {index > 0 ? ', ' : null}
                <Abbr
                  title={signalTitle(signal, candidate.nameSimilarity)}
                  className="text-slate-200"
                >
                  {de.feature.protectedCandidatesSignal[signal]}
                </Abbr>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      {suggested.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-300">{de.feature.protectedCandidatesCta}</p>
          <code className="self-start rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-xs break-all text-slate-200 ring-1 ring-slate-700/80">
            {suggested.map(([key, value]) => (
              <span key={key} className="block">
                {key}={<TagValue tagKey={key} value={value} />}
              </span>
            ))}
          </code>
          {suggested.some(([key]) => key === 'dtp_id') ? (
            <p className="max-w-3xl text-xs text-slate-400">
              {de.feature.protectedCandidatesDtpIdNote.before}
              <a
                href={de.feature.protectedCandidatesDtpIdNote.href}
                className={LINK_CLASS}
                target="_blank"
                rel="noreferrer"
              >
                {de.feature.protectedCandidatesDtpIdNote.linkText}
              </a>
              {de.feature.protectedCandidatesDtpIdNote.after}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <a
          href={osmEditUrl(candidate)}
          className={sharedButtonClass}
          target="_blank"
          rel="noreferrer"
        >
          {de.feature.candidatesEditLink}
        </a>
        <CopyTagsButton
          tags={candidate.suggestedTags ?? {}}
          ariaLabel={de.feature.copyTagsAria(objectLabel)}
          className={sharedButtonClass}
        />
        <a
          href={osmObjectUrl(candidate)}
          className={`text-sm ${LINK_CLASS}`}
          target="_blank"
          rel="noreferrer"
        >
          {de.feature.candidatesViewLink}
        </a>
        {candidate.osmType === 'relation' ? (
          <a
            href={relationResolverHref(areaKey, candidate.osmId)}
            className={`text-sm ${LINK_CLASS}`}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={de.feature.liveOsmHitOpenBoundaryCheckerAria(
              candidate.osmType,
              liveObject.id,
            )}
          >
            {de.feature.liveOsmHitOpenBoundaryChecker(candidate.osmType, liveObject.id)}
          </a>
        ) : null}
        {nearby ? null : <LiveOsmObjectLoadButton context={context} object={liveObject} />}
      </div>

      {nearby ? (
        <NearbyOsmObjectTags
          type={liveObject.type}
          id={liveObject.id}
          tags={candidate.tags ?? {}}
          context={context}
        />
      ) : (
        <>
          <p className="text-xs break-words text-slate-500">
            {de.feature.protectedCandidatesColumnCurrent}{' '}
            <span className="font-mono">
              {current.length > 0
                ? current.map((pair, index) => (
                    <span key={pair}>
                      {index > 0 ? ', ' : null}
                      <TagPairText pair={pair} />
                    </span>
                  ))
                : de.feature.protectedCandidatesCurrentNone}
            </span>
          </p>
          <LiveOsmObjectResult context={context} object={liveObject} />
        </>
      )}
    </li>
  )
}

export function ProtectedAreaCandidatesList({
  candidates,
  nearby,
  areaKey,
  context,
}: {
  candidates: CandidateMatch[]
  /** Objects from the nearby search, listed after the candidates. */
  nearby: CandidateMatch[]
  areaKey: string
  context: LiveOsmContext
}) {
  return (
    <ul className="divide-y divide-sky-800/45">
      {candidates.map((candidate) => (
        <ProtectedAreaCandidateRow
          key={`${candidate.osmType}/${candidate.osmId}`}
          candidate={candidate}
          areaKey={areaKey}
          context={context}
        />
      ))}
      {nearby.map((candidate) => (
        <ProtectedAreaCandidateRow
          key={`nearby-${candidate.osmType}/${candidate.osmId}`}
          candidate={candidate}
          areaKey={areaKey}
          context={context}
          nearby
        />
      ))}
    </ul>
  )
}
