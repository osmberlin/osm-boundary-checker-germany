import type { ReactNode } from 'react'

/** Row 1: heading, relative age (large), absolute datetime (small). */
export function SummaryStatColumn({
  heading,
  relativeLine,
  absoluteLine,
  detailLine,
  isOld = false,
  headingAdornment,
  hideDetailLine = false,
}: {
  heading: string
  relativeLine: string
  absoluteLine: string
  detailLine?: string | null
  isOld?: boolean
  headingAdornment?: ReactNode
  /** When true, hide the tertiary "Download:" line (official column shows reference date only). */
  hideDetailLine?: boolean
}) {
  const compactRelativeLine = relativeLine.replace(/\bStunden?\b/g, 'Std.')
  const mobileAbsoluteLine = toNumericMonthAbsoluteDe(absoluteLine)

  return (
    <div className="flex min-w-0 flex-col gap-y-1">
      <dt className="text-sm font-medium text-slate-400">
        {headingAdornment ? (
          <span className="inline-flex items-center gap-1">
            <span>{heading}</span>
            {headingAdornment}
          </span>
        ) : (
          heading
        )}
      </dt>
      <dd
        className={`m-0 text-2xl font-semibold tracking-tight text-pretty tabular-nums sm:text-3xl ${isOld ? 'text-rose-300' : 'text-slate-400'}`}
      >
        <span className="sm:hidden">{compactRelativeLine}</span>
        <span className="hidden sm:inline">{compactRelativeLine}</span>
      </dd>
      <dd className={`m-0 text-sm ${isOld ? 'text-rose-300' : 'text-slate-400'}`}>
        <span className="sm:hidden">{mobileAbsoluteLine}</span>
        <span className="hidden sm:inline">{absoluteLine}</span>
      </dd>
      {hideDetailLine || !detailLine ? null : (
        <dd className="m-0 text-xs text-slate-500">{detailLine}</dd>
      )}
    </div>
  )
}

function toNumericMonthAbsoluteDe(value: string): string {
  const monthByName: Record<string, string> = {
    Januar: '01',
    Februar: '02',
    März: '03',
    April: '04',
    Mai: '05',
    Juni: '06',
    Juli: '07',
    August: '08',
    September: '09',
    Oktober: '10',
    November: '11',
    Dezember: '12',
  }
  const m = value.match(/^(\d{1,2})\.\s+([A-Za-zÄÖÜäöüß]+)\s+(\d{4})\s+(\d{2}:\d{2})$/)
  if (!m) return value
  const day = m[1]?.padStart(2, '0')
  const monthName = m[2]
  const year = m[3]
  const time = m[4]
  const month = monthName ? monthByName[monthName] : null
  if (!day || !month || !year || !time) return value
  return `${day}.${month}.${year} ${time}`
}
