import { de } from '../../i18n/de'
import type { Ars12Segments } from '../../lib/germanKeyExplorer'
import type { ArsSegmentNameCells } from '../../lib/germanKeyLookupBundle'

function CellName({
  resolved,
  fallbackLabel,
}: {
  resolved: { value: string | null; obsolete?: { year: number } }
  fallbackLabel: string | null
}) {
  const name = resolved.value ?? fallbackLabel
  if (name === null) return <span className="text-slate-500">—</span>
  return (
    <span>
      <span className={resolved.obsolete ? 'text-amber-200/95' : undefined}>{name}</span>
      {resolved.obsolete ? (
        <span className="ml-1 text-xs font-normal text-amber-400/90">
          ({de.germanKeyExplorer.obsoleteYearSuffix(resolved.obsolete.year)})
        </span>
      ) : null}
    </span>
  )
}

const emptyCells = (): ArsSegmentNameCells => ({
  bundesland: { value: null },
  regierungsbezirk: { value: null },
  kreis: { value: null },
  gemeindeverband: { value: null },
  gemeinde: { value: null },
})

export function ArsSegmentsTable({
  segments,
  nameCells,
}: {
  segments: Ars12Segments | null
  nameCells: ArsSegmentNameCells | null
}) {
  const t = de.germanKeyExplorer
  const cells = nameCells ?? emptyCells()
  const rows: Array<{
    label: string
    value: string
    span: string
    resolved: ArsSegmentNameCells[keyof ArsSegmentNameCells]
    fallbackLabel: string | null
  }> = segments
    ? [
        {
          label: t.segmentBl,
          value: segments.bundesland,
          span: '1–2',
          resolved: cells.bundesland,
          fallbackLabel: null,
        },
        {
          label: t.segmentRb,
          value: segments.regierungsbezirk,
          span: '3',
          resolved: cells.regierungsbezirk,
          fallbackLabel: segments.regierungsbezirk === '0' ? t.noRegierungsbezirk : null,
        },
        {
          label: t.segmentKreis,
          value: segments.kreis,
          span: '4–5',
          resolved: cells.kreis,
          fallbackLabel: null,
        },
        {
          label: t.segmentVg,
          value: segments.gemeindeverband,
          span: '6–9',
          resolved: cells.gemeindeverband,
          fallbackLabel: segments.gemeindeverband === '0000' ? t.noGemeindeverband : null,
        },
        {
          label: t.segmentGem,
          value: segments.gemeinde,
          span: '10–12',
          resolved: cells.gemeinde,
          fallbackLabel: null,
        },
      ]
    : []

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/40">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-700 bg-slate-900/80">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-300">Segment</th>
            <th className="px-3 py-2 text-left font-medium text-slate-300">Stellen</th>
            <th className="px-3 py-2 text-left font-mono text-xs font-medium text-slate-200">
              Ziffern
            </th>
            <th className="px-3 py-2 text-left font-medium text-slate-300">{t.colName}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/80">
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-slate-500" colSpan={4}>
                {t.arsTableEmpty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.label} className="text-slate-200">
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2 text-slate-400">{row.span}</td>
                <td className="px-3 py-2 font-mono text-slate-100">{row.value}</td>
                <td className="px-3 py-2 text-slate-300">
                  <CellName resolved={row.resolved} fallbackLabel={row.fallbackLabel} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
