import { de } from '../../i18n/de'
import type { ResolvedField } from '../../lib/germanKeyLookupBundle'

export type SegmentsTableRow = {
  /** Localised row label, e.g. "Bundesland". */
  label: string
  /** Segment shorthand shown next to the label, e.g. `LL`, `R`, `KK`, `VVVV`, `GGG`. */
  shortCode: 'LL' | 'R' | 'KK' | 'VVVV' | 'GGG'
  /** Digits at the slot, or `null` when the slot is not present in the user's input. */
  digits: string | null
  /** Inclusive 1-indexed slot range, e.g. "1–2", "10–12". Used purely for display. */
  span: string
  /** Inclusive 1-indexed slot start (1..) — used for padding classification (ARS view). */
  startPos: number
  /** Inclusive 1-indexed slot end — used for padding classification (ARS view). */
  endPos: number
  /** Resolved name + obsolete + AGS-view flags. */
  resolved: ResolvedField
  /** Optional fallback label when lookup misses but the segment has a known empty meaning (e.g. "Kein Regierungsbezirk"). */
  fallbackLabel: string | null
  /**
   * AGS view marker: present only on the VVVV row when the segments table is rendered for an
   * 8-digit AGS input. Toggles muted/subdued styling and a "(aufgelöst aus Gemeindeverzeichnis)" caption
   * when the reverse lookup succeeded.
   */
  agsView?: 'not-in-ags' | 'from-lookup'
}

/** Padding state for ARS-view rows. AGS-view rows ignore this and use `agsView` instead. */
function arsPaddingState(
  row: Pick<SegmentsTableRow, 'startPos' | 'endPos'>,
  originalDigitsLen: number,
): 'fully-padded' | 'partially-padded' | 'in-input' {
  if (originalDigitsLen < row.startPos) return 'fully-padded'
  if (originalDigitsLen < row.endPos) return 'partially-padded'
  return 'in-input'
}

function CellName({
  row,
  paddingState,
}: {
  row: SegmentsTableRow
  paddingState: 'fully-padded' | 'partially-padded' | 'in-input'
}) {
  const t = de.germanKeyExplorer
  const { resolved, fallbackLabel, agsView } = row

  if (agsView === 'not-in-ags') {
    return <span className="text-slate-500 italic">{t.agsViewVvvvNotInAgs}</span>
  }

  if (agsView === 'from-lookup') {
    if (resolved.value !== null) {
      return (
        <span className="text-slate-400">
          <span className={resolved.obsolete ? 'text-amber-200/95' : undefined}>
            {resolved.value}
          </span>
          {resolved.obsolete ? (
            <span className="ml-1 text-xs font-normal text-amber-400/90">
              ({t.obsoleteYearSuffix(resolved.obsolete.year)})
            </span>
          ) : null}
          <span className="ml-1 text-xs text-slate-500 italic">{t.agsViewVvvvFromLookup}</span>
        </span>
      )
    }
    return (
      <span className="text-slate-500 italic">
        {t.agsViewVvvvNotInAgs}
        <span className="ml-1 text-xs">{t.agsViewVvvvFromLookup}</span>
      </span>
    )
  }

  if (paddingState === 'fully-padded') {
    return <span className="text-slate-500 italic">{t.segmentNotInKey}</span>
  }

  if (resolved.value !== null) {
    return (
      <span>
        <span className={resolved.obsolete ? 'text-amber-200/95' : undefined}>
          {resolved.value}
        </span>
        {resolved.obsolete ? (
          <span className="ml-1 text-xs font-normal text-amber-400/90">
            ({t.obsoleteYearSuffix(resolved.obsolete.year)})
          </span>
        ) : null}
      </span>
    )
  }

  if (fallbackLabel !== null && paddingState === 'in-input') {
    return <span>{fallbackLabel}</span>
  }

  return <span className="text-amber-200">{t.segmentNoNameFound}</span>
}

export function ArsSegmentsTable({
  rows,
  originalDigitsLen,
}: {
  rows: SegmentsTableRow[]
  /** Length of the unpadded input digits (`digitsOnly(raw).length`). Drives padding state for ARS view. */
  originalDigitsLen: number
}) {
  const t = de.germanKeyExplorer

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/40">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-700 bg-slate-900/80">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-300">Segment</th>
            <th className="px-3 py-2 text-left font-medium text-slate-300">Stellen</th>
            <th className="px-3 py-2 text-left font-medium text-slate-300">Werte</th>
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
            rows.map((row) => {
              const paddingState =
                row.agsView !== undefined ? 'in-input' : arsPaddingState(row, originalDigitsLen)
              const isMutedRow = row.agsView !== undefined || paddingState === 'fully-padded'
              return (
                <tr
                  key={row.label}
                  className={isMutedRow ? 'bg-slate-900/40 text-slate-400' : 'text-slate-200'}
                >
                  <td className="px-3 py-2">
                    <span>{row.label}</span>
                    <span className="ml-2 font-mono text-xs text-slate-500">{row.shortCode}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{row.span}</td>
                  <td className="px-3 py-2 font-mono text-slate-100">
                    {row.digits === null ? (
                      <span className="text-slate-500">—</span>
                    ) : paddingState === 'fully-padded' ? (
                      <span className="text-slate-500">—</span>
                    ) : (
                      <span className={isMutedRow ? 'text-slate-400' : undefined}>
                        {row.digits}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    <CellName row={row} paddingState={paddingState} />
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
