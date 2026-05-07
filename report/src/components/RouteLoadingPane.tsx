import type { ReactNode } from 'react'

type Props = {
  /** Primary line, e.g. "Lade Vergleichsdaten für Deutschland Verwaltungsgemeinschaften (ca. 4.611 Datensätze)…" */
  title: ReactNode
  /** Optional muted second line. */
  subtitle?: ReactNode
}

/** Centered spinner shown by route `pendingComponent` while a TanStack Router loader runs. */
export function RouteLoadingPane({ title, subtitle }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 py-12 text-center sm:px-6 lg:px-8"
    >
      <Spinner />
      <p className="text-sm text-slate-300 sm:text-base">{title}</p>
      {subtitle ? <p className="text-xs text-slate-500 sm:text-sm">{subtitle}</p> : null}
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="size-8 animate-spin text-sky-400"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  )
}
