import { HeartIcon } from '@heroicons/react/20/solid'
import { de } from '../i18n/de'

const bodyFooterLinkClass =
  'rounded-sm underline underline-offset-2 transition-[color,text-decoration-color] duration-150 ' +
  'text-emerald-500/65 decoration-emerald-600/22 ' +
  'group-hover/footer:text-emerald-300 group-hover/footer:decoration-emerald-400 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-emerald-500/40'

export function AppFooter() {
  const f = de.footer

  return (
    <footer className="group/footer border-t border-zinc-800 bg-zinc-950/40 py-8 text-xs text-zinc-400">
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
            {f.geoDataBetween}
            <a
              href={f.bkgLinkHref}
              className={bodyFooterLinkClass}
              target="_blank"
              rel="noreferrer"
            >
              {f.bkgLinkLabel}
            </a>
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
      </div>
    </footer>
  )
}
