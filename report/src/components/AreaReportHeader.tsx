import { de } from '../i18n/de'
import { DiscussDatasetButton } from './discussion/DiscussDatasetButton'

function Middot() {
  return (
    <span className="text-slate-600" aria-hidden>
      ·
    </span>
  )
}

type Props = {
  title: string
  sourceName: string | null
  sourceHref: string | null
}

/** Area title + meta (official source · discuss); spacing below from parent `gap-6`. */
export function AreaReportHeader({ title, sourceName, sourceHref }: Props) {
  const isHashLink = sourceHref != null && sourceHref.startsWith('#')
  const showSource = Boolean(sourceName)

  return (
    <header>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="max-w-full min-w-0 flex-[1_1_0] text-2xl font-semibold tracking-tight text-slate-100">
          {title}
        </h1>
        <div className="ml-auto flex w-fit max-w-full flex-wrap items-baseline justify-end gap-x-2 text-xs">
          {showSource ? (
            <span className="text-slate-500">
              {de.footer.geoDataLine}
              {sourceHref ? (
                <a
                  href={sourceHref}
                  className="underline decoration-slate-500/60 underline-offset-2 transition-colors hover:text-slate-300"
                  {...(isHashLink ? {} : { target: '_blank', rel: 'noreferrer' })}
                >
                  {sourceName}
                </a>
              ) : (
                sourceName
              )}
            </span>
          ) : null}
          {showSource ? <Middot /> : null}
          <DiscussDatasetButton className="inline shrink-0 align-baseline text-xs font-medium text-sky-400 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-300" />
        </div>
      </div>
    </header>
  )
}
