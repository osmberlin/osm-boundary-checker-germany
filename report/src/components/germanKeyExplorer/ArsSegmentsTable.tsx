import { de } from '../../i18n/de'
import type { Ars12Segments } from '../../lib/germanKeyExplorer'

export function ArsSegmentsTable({ segments }: { segments: Ars12Segments | null }) {
  const t = de.germanKeyExplorer
  const rows: Array<{ label: string; value: string; span: string }> = segments
    ? [
        { label: t.segmentBl, value: segments.bundesland, span: '1–2' },
        { label: t.segmentRb, value: segments.regierungsbezirk, span: '3' },
        { label: t.segmentKreis, value: segments.kreis, span: '4–5' },
        { label: t.segmentVg, value: segments.gemeindeverband, span: '6–9' },
        { label: t.segmentGem, value: segments.gemeinde, span: '10–12' },
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
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/80">
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-slate-500" colSpan={3}>
                {t.arsTableEmpty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.label} className="text-slate-200">
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2 text-slate-400">{row.span}</td>
                <td className="px-3 py-2 font-mono text-slate-100">{row.value}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
