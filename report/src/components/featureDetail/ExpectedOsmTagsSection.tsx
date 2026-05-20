import { Link } from '@tanstack/react-router'
import { areasIndex } from '../../data/areasIndex'
import { de } from '../../i18n/de'
import {
  germanKeyExplorerLinkValueOrNull,
  isGermanKeyExplorerDisplayKey,
} from '../../lib/germanKeyExplorer'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { GermanKeyVerifyLink } from '../GermanKeyVerifyLink'
import { ProvenanceGridRow } from '../ProvenanceGridRow'
import { ProvenanceGridSectionHeader } from '../ProvenanceGridSectionHeader'

function TagRows({
  boundaryValue,
  adminLevels,
  matchProperties,
  matchValue,
}: {
  boundaryValue: string
  adminLevels: string[] | undefined
  matchProperties: string[]
  matchValue: string
}) {
  const rows: Array<{ key: string; value: string; reactKey: string }> = [
    { key: 'boundary', value: boundaryValue, reactKey: 'boundary' },
  ]
  if (adminLevels?.length) {
    for (let i = 0; i < adminLevels.length; i++) {
      const level = adminLevels[i]!
      rows.push({ key: 'admin_level', value: level, reactKey: `admin_level-${i}-${level}` })
    }
  }
  for (let i = 0; i < matchProperties.length; i++) {
    const matchProperty = matchProperties[i]!
    rows.push({
      key: matchProperty,
      value: matchValue,
      reactKey: `match-${i}-${matchProperty}`,
    })
  }

  const verifyLinkClass =
    'shrink-0 text-xs font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

  return (
    <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {rows.map(({ key, value, reactKey }) => {
        const keyForLink = germanKeyExplorerLinkValueOrNull(value)
        const showVerify = isGermanKeyExplorerDisplayKey(key) && keyForLink !== null
        return (
          <div key={reactKey} className="contents">
            <dt className="font-mono text-xs break-words text-slate-400">{key}</dt>
            <dd className="min-w-0 break-words text-slate-100">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="min-w-0">{value}</span>
                {showVerify && keyForLink ? (
                  <GermanKeyVerifyLink keyValue={keyForLink} className={verifyLinkClass} />
                ) : null}
              </span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** Shown for official-only rows: tags the comparator expects on the OSM side. */
export function ExpectedOsmTagsSection({
  areaKey,
  data,
  row,
}: {
  areaKey: string
  data: ComparisonForReport
  row: ReportRow
}) {
  if (row.category !== 'official_only') return null

  const summary = areasIndex.summaries.find((s) => s.area === areaKey)
  const boundaryValue = data.overpassBoundaryTag ?? 'administrative'
  const adminLevels = summary?.osmAdminLevels ?? data.filterConfigSummary.adminLevels
  const matchProperties =
    data.filterConfigSummary.osmMatchProperties?.map((x) => x.trim()).filter((x) => x.length > 0) ??
    summary?.osmMatchProperties?.map((x) => x.trim()).filter((x) => x.length > 0) ??
    []
  const showKeyExplorer = matchProperties.some((mp) => isGermanKeyExplorerDisplayKey(mp))

  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={de.feature.expectedOsmTagsSectionAria}
    >
      <ProvenanceGridSectionHeader title={de.feature.expectedOsmTagsSectionTitle}>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">
          {de.feature.expectedOsmTagsSectionLead}
        </p>
        {showKeyExplorer ? (
          <p className="mt-3">
            <Link
              to="/tools/german-key"
              search={{ key: row.canonicalMatchKey }}
              className="text-sm font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
            >
              {de.feature.decodeKeyExplorerLink}
            </Link>
          </p>
        ) : null}
      </ProvenanceGridSectionHeader>
      <div className="border-t border-slate-700">
        <dl>
          <ProvenanceGridRow
            asDl
            surfaceClassName="bg-red-950/18"
            rightColumnClassName="mt-2"
            title={<span className="text-sm/6 font-medium text-slate-200">OSM</span>}
          >
            <TagRows
              boundaryValue={boundaryValue}
              adminLevels={adminLevels}
              matchProperties={matchProperties}
              matchValue={row.canonicalMatchKey}
            />
          </ProvenanceGridRow>
        </dl>
      </div>
    </section>
  )
}
