import { de } from '../../i18n/de'
import type { AttributeHint, ReportRow } from '../../types/report'
import { ProvenanceGridSectionHeader } from '../ProvenanceGridSectionHeader'
import { CopyTagsButton } from './CopyTagsButton'

function TagLines({ lines, emptyLabel }: { lines: string[]; emptyLabel: string }) {
  if (lines.length === 0) return <span className="text-slate-500">{emptyLabel}</span>
  return (
    <>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </>
  )
}

function hintTitle(hint: AttributeHint, categoryName: string | null): string {
  const titles = de.feature.attributeHints.titles
  if (hint.id === 'type_tags') return titles.type_tags(categoryName)
  return titles[hint.id]
}

/** Tag suggestions for a matched protected-area row (shard `attributeHints`); not shown without hints. */
export function AttributeHintsSection({
  row,
  hints,
}: {
  row: ReportRow
  hints: AttributeHint[] | undefined
}) {
  if (row.category !== 'matched' || !hints || hints.length === 0) return null
  const t = de.feature.attributeHints
  const rawCategoryName = row.officialProperties?.category_name
  const categoryName =
    typeof rawCategoryName === 'string' && rawCategoryName.trim().length > 0
      ? rawCategoryName.trim()
      : null

  return (
    <section
      className="overflow-hidden rounded-lg border border-amber-800/50 bg-amber-950/30 shadow-sm"
      aria-label={t.aria}
    >
      <ProvenanceGridSectionHeader title={t.title}>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">{t.lead}</p>
      </ProvenanceGridSectionHeader>
      <ul className="divide-y divide-amber-800/40 border-t border-amber-800/45">
        {hints.map((hint) => (
          <li key={hint.id} className="flex flex-col gap-3 px-4 py-4 sm:px-6">
            <p className="text-sm font-medium text-slate-100">{hintTitle(hint, categoryName)}</p>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  {t.expected}
                </dt>
                <dd className="font-mono text-xs break-words text-slate-100">
                  <TagLines lines={hint.expected} emptyLabel={t.actualNone} />
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  {t.actual}
                </dt>
                <dd className="font-mono text-xs break-words text-slate-100">
                  <TagLines lines={hint.actual} emptyLabel={t.actualNone} />
                </dd>
              </div>
            </dl>
            {hint.suggestedTags && Object.keys(hint.suggestedTags).length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium tracking-wide text-slate-400 uppercase">
                  {t.suggestion}
                </span>
                <code className="rounded bg-slate-950/80 px-1.5 py-0.5 font-mono break-all text-slate-200 ring-1 ring-slate-700/80">
                  {Object.entries(hint.suggestedTags)
                    .map(([key, value]) => `${key}=${value}`)
                    .join(', ')}
                </code>
                <CopyTagsButton
                  tags={hint.suggestedTags}
                  ariaLabel={`${t.suggestion}: ${hintTitle(hint, categoryName)}`}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
