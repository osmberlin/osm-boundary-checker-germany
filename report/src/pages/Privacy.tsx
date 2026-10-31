import { de } from '../i18n/de'
import { GITHUB_REPO_ROOT } from '../lib/githubRepo'

const t = de.privacy

const LINK_CLASS =
  'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

const TRIGGER_LABELS = { automatic: t.automaticLabel, onClick: t.onClickLabel }

export function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 text-left sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-100">{t.title}</h1>
        <p className="mt-3 text-slate-300">{t.lead}</p>
      </header>

      <div className="flex flex-col gap-6">
        {t.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="flex flex-wrap items-baseline gap-x-3 text-lg font-semibold text-slate-100">
              {section.heading}
              {section.trigger ? (
                <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                  {TRIGGER_LABELS[section.trigger]}
                </span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-slate-300">{section.text}</p>
            {section.link ? (
              <a
                href={section.link.href}
                target="_blank"
                rel="noreferrer"
                className={`mt-1 inline-block text-sm ${LINK_CLASS}`}
              >
                {section.link.label}
              </a>
            ) : null}
          </section>
        ))}
      </div>

      <p className="mt-8 text-sm text-slate-300">
        {t.questionsLead}
        <a
          href={`${GITHUB_REPO_ROOT}/issues`}
          target="_blank"
          rel="noreferrer"
          className={LINK_CLASS}
        >
          {t.questionsLink}
        </a>
      </p>
    </div>
  )
}
