import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { StatBlock, StatBlocksRow } from '../components/FeatureStatBlocks'
import { ReportCategoryPill, UnmatchedOsmStatPill } from '../components/reportCategoryStyles'
import { areasIndexUrl } from '../data/paths'
import { categoryLabelDe, de } from '../i18n/de'
import { EM_DASH, formatDeInteger } from '../lib/formatDe'

type AreaSummary = {
  area: string
  matched: number
  officialOnly: number
  unmatchedOsm: number
}

export function Home() {
  const [areas, setAreas] = useState<string[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [summariesByArea, setSummariesByArea] = useState<Record<string, AreaSummary>>({})

  useEffect(() => {
    let cancelled = false
    fetch(areasIndexUrl())
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<{ areas?: unknown; summaries?: unknown }>
      })
      .then((body) => {
        if (cancelled) return
        const list = body.areas
        const areasList = Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
        const summaries: Record<string, AreaSummary> = {}
        if (Array.isArray(body.summaries)) {
          for (const entry of body.summaries) {
            if (!entry || typeof entry !== 'object') continue
            const s = entry as Record<string, unknown>
            const area = typeof s.area === 'string' ? s.area : null
            if (!area) continue
            summaries[area] = {
              area,
              matched: typeof s.matched === 'number' ? s.matched : 0,
              officialOnly: typeof s.officialOnly === 'number' ? s.officialOnly : 0,
              unmatchedOsm: typeof s.unmatchedOsm === 'number' ? s.unmatchedOsm : 0,
            }
          }
        }
        setSummariesByArea(summaries)
        setAreas(areasList)
        setLoadError(false)
      })
      .catch(() => {
        if (cancelled) return
        setSummariesByArea({})
        setAreas([])
        setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
            const entry = summariesByArea[a]
            const matched = entry ? formatDeInteger(entry.matched) : EM_DASH
            const officialOnly = entry ? formatDeInteger(entry.officialOnly) : EM_DASH
            const unmatched = entry ? formatDeInteger(entry.unmatchedOsm) : EM_DASH
            return (
              <li key={a} className="rounded border border-slate-700 bg-slate-900 p-4">
                <Link
                  className="font-medium text-sky-400 underline hover:text-sky-300"
                  to="/$areaId"
                  params={{ areaId: a }}
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
                    value={matched}
                  />
                  <StatBlock
                    label={
                      <ReportCategoryPill category="official_only">
                        {categoryLabelDe('official_only')}
                      </ReportCategoryPill>
                    }
                    value={officialOnly}
                  />
                  <StatBlock
                    label={<UnmatchedOsmStatPill>{de.home.unmatchedStat}</UnmatchedOsmStatPill>}
                    value={unmatched}
                  />
                </StatBlocksRow>
                {entry != null && entry.unmatchedOsm > 0 ? (
                  <p className="mt-3 text-sm">
                    <Link
                      className="text-sky-400 underline"
                      to="/$areaId/unmatched"
                      params={{ areaId: a }}
                    >
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
