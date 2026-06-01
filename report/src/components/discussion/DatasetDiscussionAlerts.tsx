import { InformationCircleIcon } from '@heroicons/react/20/solid'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { de as deLocale } from 'date-fns/locale/de'
import {
  discussionIssuesForPathMatch,
  emptyDiscussionRegistryFile,
} from '../../../../scripts/shared/discussionsRegistry.ts'
import {
  discussionsRegistryQueryOptions,
  discussionsRegistrySyncMetaQueryOptions,
} from '../../data/load'
import { de } from '../../i18n/de'
import { cn } from '../../lib/cn'
import { parseIsoToBerlin } from '../../lib/time/parse'
import { useDiscussPageLinkParts } from '../../lib/useDiscussPageLinkParts'

function formatLastTouchedRelative(iso: string): string {
  const berlin = parseIsoToBerlin(iso)
  if (!berlin) return iso
  return formatDistanceToNow(berlin, { locale: deLocale, addSuffix: true })
}

export function DatasetDiscussionAlerts() {
  const registryQuery = useQuery(discussionsRegistryQueryOptions())
  const syncMetaQuery = useQuery(discussionsRegistrySyncMetaQueryOptions())
  const registry = registryQuery.data ?? emptyDiscussionRegistryFile()
  const syncMeta = syncMetaQuery.data
  const { matchKey } = useDiscussPageLinkParts()
  const items = discussionIssuesForPathMatch(registry, matchKey)
  if (items.length === 0) return null

  const checkedRelative =
    syncMeta?.registryCheckedAt != null && syncMeta.registryCheckedAt !== ''
      ? formatLastTouchedRelative(syncMeta.registryCheckedAt)
      : null

  const openCardClass =
    'group block rounded-md border border-emerald-400 bg-emerald-100 p-4 outline-none transition-colors hover:border-emerald-500 hover:bg-emerald-200 dark:border-emerald-500 dark:bg-emerald-500/25 dark:hover:border-emerald-400 dark:hover:bg-emerald-500/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500'
  const closedCardClass =
    'group block rounded-md border border-slate-300 bg-slate-100 p-4 outline-none transition-colors hover:border-slate-400 hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-slate-500 dark:hover:bg-slate-800/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500'

  return (
    <div className="space-y-3">
      {items.map((issue) => {
        const isOpen = issue.state === 'open'
        const stateLabel = isOpen ? de.discuss.stateOpen : de.discuss.stateClosed
        const statusParts = [
          `${de.discuss.alertStatusPrefix}: ${stateLabel}`,
          de.discuss.alertLastActive(formatLastTouchedRelative(issue.lastTouchedAt)),
        ]
        if (checkedRelative != null) {
          statusParts.push(de.discuss.alertLastChecked(checkedRelative))
        }
        const statusLine = statusParts.join(' · ')
        return (
          <a
            key={issue.number}
            href={issue.url}
            target="_blank"
            rel="noreferrer"
            className={cn(isOpen ? openCardClass : closedCardClass, 'cursor-pointer')}
          >
            <div className="flex">
              <div className="shrink-0">
                <InformationCircleIcon
                  aria-hidden
                  className={cn(
                    'size-5',
                    isOpen
                      ? 'text-emerald-500 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500',
                  )}
                />
              </div>
              <div className="ml-3 min-w-0 flex-1 md:flex md:items-start md:justify-between md:gap-6">
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isOpen
                        ? 'text-emerald-900 dark:text-emerald-100'
                        : 'text-slate-800 dark:text-slate-100',
                    )}
                  >
                    {isOpen ? (
                      de.discuss.alertTitle
                    ) : (
                      <>
                        {de.discuss.alertTitleClosedBefore}
                        <strong className="font-semibold">
                          {de.discuss.alertTitleClosedEmphasis}
                        </strong>
                        {de.discuss.alertTitleClosedAfter}
                      </>
                    )}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-xs',
                      isOpen
                        ? 'text-emerald-800/90 dark:text-emerald-300/80'
                        : 'text-slate-600/90 dark:text-slate-400/85',
                    )}
                  >
                    {statusLine}
                  </p>
                </div>
                <p className="mt-3 shrink-0 text-sm md:mt-0 md:ml-6">
                  <span
                    className={cn(
                      'font-medium whitespace-nowrap',
                      isOpen
                        ? 'text-emerald-800 group-hover:text-emerald-700 dark:text-emerald-200 dark:group-hover:text-emerald-100'
                        : 'text-slate-700 group-hover:text-slate-600 dark:text-slate-300 dark:group-hover:text-slate-200',
                    )}
                  >
                    {de.discuss.openDiscussion}
                    <span aria-hidden> →</span>
                  </span>
                </p>
              </div>
            </div>
          </a>
        )
      })}
    </div>
  )
}
