import { Link } from '@tanstack/react-router'
import { areasIndex } from '../../data/areasIndex'
import { de } from '../../i18n/de'
import { isSchluesselExplorerPreset } from '../../lib/germanKeyExplorer'
import type { ComparisonForReport, ReportRow } from '../../types/report'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="contents">
      <dt className="font-mono text-xs break-words text-slate-400">{label}</dt>
      <dd className="break-words text-slate-100">{value}</dd>
    </div>
  )
}

/** Shown for unmatched_osm rows: same compare criteria context as for official_only expected tags. */
export function MatcherContextSection({
  areaKey,
  data,
  row,
}: {
  areaKey: string
  data: ComparisonForReport
  row: ReportRow
}) {
  if (row.category !== 'unmatched_osm') return null

  const s = de.feature
  const summary = areasIndex.summaries.find((x) => x.area === areaKey)
  const f = data.filterConfigSummary
  const boundaryValue = data.overpassBoundaryTag ?? 'administrative'
  const officialProp = f?.officialMatchProperty ?? '—'
  const osmProp = f?.osmMatchProperty ?? summary?.osmMatchProperty ?? '—'
  const adminLevels = f?.adminLevels?.join(', ') ?? summary?.osmAdminLevels?.join(', ') ?? '—'
  const bbox =
    f?.bboxFilter === 'official_bbox_overlap'
      ? `${f.bboxFilter}${f.bboxBufferDegrees != null ? ` (${f.bboxBufferDegrees}°)` : ''}`
      : (f?.bboxFilter ?? '—')
  const osmScope = f?.osmScopeFilter ?? '—'
  const ignoreIds = f?.ignoreRelationIds?.length ? f.ignoreRelationIds.join(', ') : null
  const idPreset = data.idNormalizationPreset ?? '—'
  const mc = data.osmMatchCriteria

  const mp = osmProp.trim()
  const showKeyExplorer = mp === 'de:regionalschluessel' || mp === 'de:amtlicher_gemeindeschluessel'

  return (
    <section
      className="mt-10 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={s.matcherContextSectionAria}
    >
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">{s.matcherContextSectionTitle}</h2>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">{s.matcherContextSectionLead}</p>
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
              {s.matcherDecodeKeyLink}
            </Link>
          </p>
        ) : null}
      </div>
      <div className="border-t border-slate-700">
        <dl className="grid gap-x-3 gap-y-2 px-4 py-6 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:px-6">
          <Row label={s.matcherBoundaryTag} value={boundaryValue} />
          <Row label={s.matcherOfficialProperty} value={officialProp} />
          <Row label={s.matcherOsmProperty} value={osmProp} />
          <Row label={s.matcherAdminLevels} value={adminLevels} />
          <Row label={s.matcherBboxFilter} value={bbox} />
          <Row label={s.matcherOsmScope} value={osmScope} />
          {ignoreIds ? <Row label={s.matcherIgnoreRelations} value={ignoreIds} /> : null}
          <Row label={s.matcherIdPreset} value={idPreset} />
          <Row
            label={s.matcherOsmCriteria}
            value={
              mc == null
                ? '—'
                : mc.kind === 'property'
                  ? s.matcherCriteriaProperty
                  : s.matcherCriteriaRelations(mc.relationIds.join(', '))
            }
          />
        </dl>
      </div>
    </section>
  )
}
