import { useFeatureDetailMapBoundaryScope } from '../../hooks/useFeatureDetailMapBoundaryScope'
import { de } from '../../i18n/de'
import { cn } from '../../lib/cn'
import { LIGHT_CHECKBOX_ROW_INTERACTIVE_CLASS } from '../FeatureStatBlocks'

export function FeatureDetailBoundaryScopeToggle({ className }: { className?: string }) {
  const { showOnlySelected, setShowOnlySelected } = useFeatureDetailMapBoundaryScope()

  return (
    <div
      className={cn('flex flex-wrap items-center justify-center gap-3 sm:justify-start', className)}
    >
      <button
        type="button"
        aria-pressed={showOnlySelected}
        onClick={() => setShowOnlySelected(true)}
        className={cn(
          'max-w-[11rem] cursor-pointer rounded-none px-1.5 py-1 text-left text-xs leading-snug sm:max-w-none',
          LIGHT_CHECKBOX_ROW_INTERACTIVE_CLASS,
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500',
          showOnlySelected ? 'text-slate-900' : 'text-slate-600',
        )}
      >
        {de.feature.mapBoundaryScopeOnly}
      </button>
      <label className="inline-flex shrink-0 cursor-pointer items-center">
        <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
          <input
            type="checkbox"
            checked={!showOnlySelected}
            aria-label={de.feature.mapBoundaryScopeAria}
            className="peer sr-only"
            onChange={(e) => setShowOnlySelected(!e.target.checked)}
          />
          <span className="peer-checked:ring-brand-500/50 absolute inset-0 rounded-full bg-brand-950/90 ring-1 ring-brand-800/60 transition-colors duration-200 ease-in-out ring-inset peer-checked:bg-brand-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-emerald-500" />
          <span className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-brand-50 shadow-sm ring-1 ring-brand-900/35 transition-transform duration-200 ease-in-out peer-checked:translate-x-4" />
        </span>
      </label>
      <button
        type="button"
        aria-pressed={!showOnlySelected}
        onClick={() => setShowOnlySelected(false)}
        className={cn(
          'max-w-[11rem] cursor-pointer rounded-none px-1.5 py-1 text-left text-xs leading-snug sm:max-w-none',
          LIGHT_CHECKBOX_ROW_INTERACTIVE_CLASS,
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500',
          showOnlySelected ? 'text-slate-600' : 'text-slate-900',
        )}
      >
        {de.feature.mapBoundaryScopeAll}
      </button>
    </div>
  )
}
