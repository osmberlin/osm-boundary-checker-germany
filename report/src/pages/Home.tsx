import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatBlock, StatBlocksRow } from '../components/FeatureStatBlocks'
import { ReportCategoryPill, UnmatchedOsmStatPill } from '../components/reportCategoryStyles'
import { areasIndexUrl, comparisonTableJson } from '../data/paths'
import { categoryLabelDe, de } from '../i18n/de'
import { countMatchCategories } from '../lib/countMatchCategories'
import { EM_DASH, formatDeInteger } from '../lib/formatDe'
import type { ComparisonForReport } from '../types/report'

type AreaCounts =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ok'
      counts: ReturnType<typeof countMatchCategories>
      data: ComparisonForReport
    }

export function Home() {
  const [areas, setAreas] = useState<string[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [countsByArea, setCountsByArea] = useState<Record<string, AreaCounts>>({})

  useEffect(() => {
    let cancelled = false
    fetch(areasIndexUrl)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<{ areas?: unknown }>
      })
      .then((body) => {
        if (cancelled) return
        const list = body.areas
        setAreas(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [])
        setLoadError(false)
      })
      .catch(() => {
        if (cancelled) return
        setAreas([])
        setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!areas || areas.length === 0) return
    let cancelled = false

    setCountsByArea(() => {
      const next: Record<string, AreaCounts> = {}
      for (const area of areas) {
        next[area] = { status: 'loading' }
      }
      return next
    })

    for (const area of areas) {
      fetch(comparisonTableJson(area))
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status))
          return r.json() as Promise<ComparisonForReport>
        })
        .then((data) => {
          if (cancelled) return
          setCountsByArea((prev) => ({
            ...prev,
            [area]: {
              status: 'ok',
              counts: countMatchCategories(data.rows),
              data,
            },
          }))
        })
        .catch(() => {
          if (cancelled) return
          setCountsByArea((prev) => ({ ...prev, [area]: { status: 'error' } }))
        })
    }
    return () => {
      cancelled = true
    }
  }, [areas])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-left sm:px-6 lg:px-8">
      <p className="mb-3">
        <Link className="text-sky-400 underline hover:text-sky-300" to="/status">
          {de.home.processingStatusLink}
        </Link>
      </p>
      <p className="mb-4 max-w-prose text-pretty text-slate-400">{de.home.introP1}</p>
      <p className="mb-6 max-w-prose text-pretty text-slate-400">{de.home.introP2}</p>
      <p className="mb-6 text-slate-400">
        {de.home.leadBefore}{' '}
        <code className="rounded bg-slate-800 px-1 text-slate-200">output/</code>{' '}
        {de.home.leadAfter}
      </p>
      {areas === null ? (
        <p className="text-slate-400">{de.home.loadingAreas}</p>
      ) : loadError ? (
        <p className="text-amber-200">{de.home.areasError}</p>
      ) : areas.length === 0 ? (
        <p className="text-slate-400">{de.home.noAreas}</p>
      ) : (
        <ul className="space-y-4">
          {areas.map((a) => {
            const entry = countsByArea[a]
            const v = (key: 'matched' | 'official_only') => {
              if (!entry || entry.status === 'loading') return '…'
              if (entry.status === 'error') return EM_DASH
              return formatDeInteger(entry.counts[key])
            }
            const vu = () => {
              if (!entry || entry.status === 'loading') return '…'
              if (entry.status === 'error') return EM_DASH
              const n = entry.data?.unmatchedOsm?.length ?? 0
              return formatDeInteger(n)
            }
            return (
              <li key={a} className="rounded border border-slate-700 bg-slate-900 p-4">
                <Link
                  className="font-medium text-sky-400 underline hover:text-sky-300"
                  to={`/${a}`}
                >
                  {a}
                </Link>
                <StatBlocksRow className="mt-4" aria-label={de.home.categoryStatsAria}>
                  <StatBlock
                    label={
                      <ReportCategoryPill category="matched">
                        {categoryLabelDe('matched')}
                      </ReportCategoryPill>
                    }
                    value={v('matched')}
                  />
                  <StatBlock
                    label={
                      <ReportCategoryPill category="official_only">
                        {categoryLabelDe('official_only')}
                      </ReportCategoryPill>
                    }
                    value={v('official_only')}
                  />
                  <StatBlock
                    label={<UnmatchedOsmStatPill>{de.home.unmatchedStat}</UnmatchedOsmStatPill>}
                    value={vu()}
                  />
                </StatBlocksRow>
                {entry?.status === 'ok' && (entry.data?.unmatchedOsm?.length ?? 0) > 0 ? (
                  <p className="mt-3 text-sm">
                    <Link className="text-sky-400 underline" to={`/${a}/unmatched`}>
                      {de.home.unmatchedLink}
                    </Link>
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
