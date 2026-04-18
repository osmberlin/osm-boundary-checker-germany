import { HomeIcon } from '@heroicons/react/20/solid'
import { Link } from '@tanstack/react-router'
import { de } from '../i18n/de'

export type AppBreadcrumbCrumb = { name: string; to: string } | { name: string; current: true }

function BreadcrumbChevron() {
  return (
    <svg
      fill="currentColor"
      viewBox="0 0 24 44"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="h-full w-6 shrink-0 text-slate-700"
    >
      <path d="M.293 0l22 22-22 22h1.414l22-22-22-22H.293z" />
    </svg>
  )
}

type Props = {
  /** App name beside the home icon (replaces a separate page title). */
  appTitle: string
  /** When true, home is the current page (not a link). */
  homeCurrent: boolean
  /** Segments after home; last entry must be `{ current: true }`. */
  items: AppBreadcrumbCrumb[]
}

export function AppBreadcrumb({ appTitle, homeCurrent, items }: Props) {
  const homeSegmentClass =
    'flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-200'
  const homeIconClass = 'size-5 shrink-0 text-slate-400 md:-ml-1'
  const rowClass = 'h-14'

  return (
    <nav
      aria-label={de.breadcrumb.navLabel}
      className="flex border-b border-slate-700 bg-brand-950/60"
    >
      <ol
        className={`mx-auto flex w-full max-w-5xl flex-nowrap items-stretch overflow-x-auto px-4 sm:px-6 lg:px-8 ${rowClass}`}
      >
        <li className="flex shrink-0 items-stretch">
          <div className={`flex items-center ${rowClass}`}>
            {homeCurrent ? (
              <span className={homeSegmentClass} aria-current="page">
                <HomeIcon aria-hidden className={homeIconClass} />
                <span className="text-brand-100">{appTitle}</span>
                <span className="sr-only">{de.breadcrumb.home}</span>
              </span>
            ) : (
              <Link
                to="/"
                className={`${homeSegmentClass} hover:[&_svg]:text-slate-300`}
                aria-label={`${de.breadcrumb.home} — ${appTitle}`}
              >
                <HomeIcon aria-hidden className={homeIconClass} />
                <span className="text-brand-100">{appTitle}</span>
              </Link>
            )}
          </div>
        </li>
        {items.map((page, index) => {
          const key = `${index}-${page.name}`
          if ('current' in page && page.current) {
            return (
              <li key={key} className="flex min-w-0 shrink-0 items-stretch">
                <div className="flex h-full min-w-0 items-stretch">
                  <BreadcrumbChevron />
                  <span
                    aria-current="page"
                    className="ml-4 flex min-w-0 items-center truncate text-sm font-medium text-slate-400"
                  >
                    {page.name}
                  </span>
                </div>
              </li>
            )
          }
          const link = page as { name: string; to: string }
          return (
            <li key={key} className="flex min-w-0 shrink-0 items-stretch">
              <div className="flex h-full min-w-0 items-stretch">
                <BreadcrumbChevron />
                <Link
                  to={link.to as never}
                  className="ml-4 flex min-w-0 items-center truncate text-sm font-medium text-slate-400 hover:text-slate-200"
                >
                  {link.name}
                </Link>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
