import { Link } from '@tanstack/react-router'
import { areasIndex } from '../../data/areasIndex'
import { de } from '../../i18n/de'
import { isSchluesselExplorerPreset } from '../../lib/germanKeyExplorer'
import type { ComparisonForReport, ReportRow } from '../../types/report'

function TagRows({
  boundaryValue,
  adminLevels,
  matchProperty,
  matchValue,
}: {
  boundaryValue: string
  adminLevels: string[] | undefined
  matchProperty: string | undefined
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
  if (matchProperty?.trim()) {
    rows.push({
      key: matchProperty.trim(),
      value: matchValue,
      reactKey: `match-${matchProperty.trim()}`,
    })
  }

  return (
    <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {rows.map(({ key, value, reactKey }) => (
        <div key={reactKey} className="contents">
          <dt className="font-mono text-xs break-words text-slate-400">{key}</dt>
          <dd className="break-words text-slate-100">{value}</dd>
        </div>
      ))}
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
  const adminLevels = summary?.osmAdminLevels ?? data.filterConfigSummary?.adminLevels
  const matchProperty = summary?.osmMatchProperty ?? data.filterConfigSummary?.osmMatchProperty
  const mpTrim = matchProperty?.trim() ?? ''
  const showKeyExplorer =
    mpTrim === 'de:regionalschluessel' || mpTrim === 'de:amtlicher_gemeindeschluessel'

  return (
    <section
      className="mt-10 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={de.feature.expectedOsmTagsSectionAria}
    >
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">
          {de.feature.expectedOsmTagsSectionTitle}
        </h2>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">
          {de.feature.expectedOsmTagsSectionLead}
        </p>
        {showKeyExplorer ? (
          <p className="mt-3">
            <Link
              to="/tools/german-key"
              search={{
                key: row.canonicalMatchKey,
                ...(data.idNormalizationPreset &&
                isSchluesselExplorerPreset(data.idNormalizationPreset)
                  ? { preset: data.idNormalizationPreset }
                  : {}),
                area: areaKey,
              }}
              className="text-sm font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
            >
              {de.feature.decodeKeyExplorerLink}
            </Link>
          </p>
        ) : null}
      </div>
      <div className="border-t border-slate-700">
        <dl>
          <div className="bg-red-950/18 px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt className="text-sm/6 font-medium text-slate-200">OSM</dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <TagRows
                boundaryValue={boundaryValue}
                adminLevels={adminLevels}
                matchProperty={matchProperty}
                matchValue={row.canonicalMatchKey}
              />
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
