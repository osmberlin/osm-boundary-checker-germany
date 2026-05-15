import { Link, useLoaderData } from '@tanstack/react-router'
import { de } from '../i18n/de'
import type { RelationResolverCandidate } from '../lib/relationResolver'

export type RelationResolverPageData = {
  objectKind: 'relation' | 'way'
  objectId: string
  candidates: RelationResolverCandidate[]
  requestedDataset: string | null
}

export function RelationResolver() {
  const data = useLoaderData({ strict: false }) as RelationResolverPageData
  const hasCandidates = data.candidates.length > 0

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 text-left sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
        {de.relationResolver.titleObject(data.objectKind, data.objectId)}
      </h1>
      {data.requestedDataset ? (
        <p className="mt-2 text-sm text-slate-400">
          {de.relationResolver.requestedDataset(data.requestedDataset)}
        </p>
      ) : null}

      {!hasCandidates ? (
        <p className="mt-4 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {de.relationResolver.notFoundObject}
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-slate-400">{de.relationResolver.listLead}</p>
          <ul className="mt-4 space-y-2">
            {data.candidates.map((candidate) => {
              const isDifferentDataset =
                data.requestedDataset != null && candidate.dataset !== data.requestedDataset
              return (
                <li
                  key={`${candidate.areaId}:${candidate.featureKey}`}
                  className={
                    isDifferentDataset
                      ? 'rounded border border-amber-700/60 bg-amber-950/20 px-3 py-2'
                      : 'rounded border border-slate-700 bg-slate-900 px-3 py-2'
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100">{candidate.featureName}</p>
                      <p className="text-xs text-slate-400">
                        {de.relationResolver.datasetLabel(candidate.dataset)}
                      </p>
                      {isDifferentDataset ? (
                        <p className="mt-1 text-xs font-medium text-amber-200">
                          {de.relationResolver.mismatchedDatasetHint}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      to="/$areaId/feature/$featureKey"
                      params={{ areaId: candidate.areaId, featureKey: candidate.featureKey }}
                      className="shrink-0 text-sm font-medium text-sky-400 underline decoration-sky-400/30 underline-offset-2 hover:text-sky-300"
                    >
                      {de.relationResolver.openFeature}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
