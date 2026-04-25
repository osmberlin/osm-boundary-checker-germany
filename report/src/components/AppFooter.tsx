import { HeartIcon } from '@heroicons/react/20/solid'
import { Link } from '@tanstack/react-router'
import { type ReactNode } from 'react'
import { areasIndex, type GeoDataSource } from '../data/areasIndex'
import { de } from '../i18n/de'

const bodyFooterLinkClass =
  'rounded-sm underline underline-offset-2 transition-[color,text-decoration-color] duration-150 ' +
  'text-sky-400/90 decoration-sky-500/30 ' +
  'group-hover/footer:text-sky-300 group-hover/footer:decoration-sky-400/60 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-sky-500/50'

const endFooterLinkClass =
  'text-sky-300 underline decoration-slate-600 underline-offset-2 transition-[text-decoration-color] duration-150 ' +
  'hover:decoration-sky-400 ' +
  'group-hover/footer:decoration-sky-400'

function renderSourceList(items: GeoDataSource[]): ReactNode {
  return items.map((item, i) => {
    const isLast = i === items.length - 1
    const separator = isLast ? null : i === items.length - 2 ? ' und ' : ', '
    return (
      <span key={`${item.name}-${item.href ?? 'nolink'}`}>
        {item.href ? (
          <a href={item.href} className={bodyFooterLinkClass} target="_blank" rel="noreferrer">
            {item.name}
          </a>
        ) : (
          item.name
        )}
        {separator}
      </span>
    )
  })
}

export function AppFooter() {
  const f = de.footer

  const fallbackGeoSources: GeoDataSource[] = [{ name: f.bkgLinkLabel, href: f.bkgLinkHref }]
  const geoSources = areasIndex.geoDataSources
  const dynamicOrFallbackGeoSources = geoSources.length > 0 ? geoSources : fallbackGeoSources
  const effectiveGeoSources = dynamicOrFallbackGeoSources.filter(
    (source) => !source.name.toLowerCase().includes('openstreetmap'),
  )

  return (
    <footer className="group/footer border-t border-slate-700 bg-slate-900/50 py-8 text-xs text-slate-400 transition-colors hover:text-slate-300">
      <div className="mx-auto max-w-5xl space-y-5 px-4 sm:px-6 lg:px-8">
        <p className="flex gap-2">
          <HeartIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-inherit" />
          <span>
            {f.geoDataLine}
            <a
              href={f.osmLinkHref}
              className={bodyFooterLinkClass}
              target="_blank"
              rel="noreferrer"
            >
              {f.osmLinkLabel}
            </a>
            {effectiveGeoSources.length > 0 ? f.geoDataBetween : null}
            {renderSourceList(effectiveGeoSources)}
            {f.geoDataSuffix}
          </span>
        </p>

        <p className="flex gap-2">
          <HeartIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-inherit" />
          <span>
            {f.openSourceComponentsLine}
            {f.openSourceThanks.map((item, i) => (
              <span key={item.href}>
                {i > 0 ? ', ' : null}
                <a
                  href={item.href}
                  className={bodyFooterLinkClass}
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.name}
                </a>
              </span>
            ))}
            .
          </span>
        </p>

        <p>
          <Link to="/status" className={endFooterLinkClass}>
            {de.home.processingStatusLink}
          </Link>
        </p>
      </div>
    </footer>
  )
}
