import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { lookupSuccessorForExplorerKey } from '../../../../scripts/shared/arsSuccessorTable.ts'
import { arsSuccessorsQueryOptions, germanKeyLookupQueryOptions } from '../../data/load'
import { de } from '../../i18n/de'
import {
  pickOfficialDatasetExtractDate,
  pickOsmDatasetExtractDate,
} from '../../lib/datasetExtractDataDates'
import { formatIsoTimestampToCompactDateDe } from '../../lib/formatSourceDownloadedAt'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { AlertNotice } from '../AlertNotice'
import { GermanKeyVerifyLink } from '../GermanKeyVerifyLink'

const verifyLinkClass =
  'text-sm font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

function compactStandDe(raw: string | null | undefined) {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const label = formatIsoTimestampToCompactDateDe(trimmed)
  return label === '' ? null : label
}

export function StaleOfficialKeySection({
  areaKey,
  row,
  data,
}: {
  areaKey: string
  row: ReportRow
  data: ComparisonForReport
}) {
  if (row.staleOfficialKey == null && row.staleOfficialPredecessor == null) return null
  return <StaleOfficialKeySectionBody areaKey={areaKey} row={row} data={data} />
}

function StaleOfficialKeySectionBody({
  areaKey,
  row,
  data,
}: {
  areaKey: string
  row: ReportRow
  data: ComparisonForReport
}) {
  const lookupQuery = useQuery(germanKeyLookupQueryOptions())
  const successorsQuery = useQuery(arsSuccessorsQueryOptions())
  const stale = row.staleOfficialKey
  const predecessor = row.staleOfficialPredecessor

  const officialArs = predecessor?.fromArs ?? row.canonicalMatchKey
  const currentArs = stale?.toArs ?? row.canonicalMatchKey
  const pairKey = stale?.pairedUnmatchedKey ?? predecessor?.fromArs
  const pairIsSuccessor = stale?.pairedUnmatchedKey != null

  const officialStand = compactStandDe(
    pickOfficialDatasetExtractDate(data.sourceMetadata.official).sourceDateRaw,
  )
  const osmStand = compactStandDe(pickOsmDatasetExtractDate(data.sourceMetadata.osm).sourceDateRaw)
  const destatisStand = compactStandDe(lookupQuery.data?.latest.source.snapshotDate)
  const successorHit = successorsQuery.data
    ? (lookupSuccessorForExplorerKey(successorsQuery.data, currentArs) ??
      lookupSuccessorForExplorerKey(successorsQuery.data, officialArs))
    : null
  const keySince = compactStandDe(successorHit?.row.validFrom)

  return (
    <section aria-label={de.feature.staleOfficialKeySectionAria}>
      <AlertNotice>
        <p className="font-medium text-amber-100">{de.feature.staleOfficialKeyTitle}</p>
        <p className="mt-2">{de.feature.staleOfficialKeyLead}</p>
        <p className="mt-2">{de.feature.staleOfficialKeyNoEditHint}</p>
        <dl className="mt-3 grid gap-y-1 text-sm">
          <div>
            <dt className="text-amber-200/80">
              {de.feature.staleOfficialKeyOfficialLabel(officialStand)}
            </dt>
            <dd className="flex flex-wrap items-baseline gap-x-3 font-mono text-amber-50">
              {officialArs}
              <GermanKeyVerifyLink keyValue={officialArs} className={verifyLinkClass} />
            </dd>
          </div>
          <div>
            <dt className="text-amber-200/80">
              {de.feature.staleOfficialKeyCurrentLabel({ destatisStand, osmStand, keySince })}
            </dt>
            <dd className="flex flex-wrap items-baseline gap-x-3 font-mono text-amber-50">
              {currentArs}
              <GermanKeyVerifyLink keyValue={currentArs} className={verifyLinkClass} />
            </dd>
          </div>
        </dl>
        {pairKey && row.category !== 'matched' ? (
          <p className="mt-3">
            <Link
              to="/$areaId/feature/$featureKey"
              params={{ areaId: areaKey, featureKey: pairKey }}
              className={verifyLinkClass}
            >
              {pairIsSuccessor
                ? de.areaReport.stats.pairLinkToSuccessor
                : de.areaReport.stats.pairLinkToPredecessor}
            </Link>
          </p>
        ) : null}
      </AlertNotice>
    </section>
  )
}
