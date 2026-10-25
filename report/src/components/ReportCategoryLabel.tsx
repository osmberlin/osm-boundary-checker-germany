import type { SourceKind } from '../../../scripts/shared/sourceKind.ts'
import { categoryLabelDe } from '../i18n/de'
import { SourceTerm } from '../i18n/sourceVocabulary'
import type { ReportRow } from '../types/report'

/** Category label as React node: the dataset's source vocabulary for `official_only` ("DtP" as `<abbr>`). */
export function ReportCategoryLabel({
  category,
  sourceKind,
}: {
  category: ReportRow['category']
  sourceKind: SourceKind | undefined
}) {
  if (category === 'official_only') return <SourceTerm kind={sourceKind} term="onlyLabel" />
  return <>{categoryLabelDe(category, sourceKind)}</>
}
