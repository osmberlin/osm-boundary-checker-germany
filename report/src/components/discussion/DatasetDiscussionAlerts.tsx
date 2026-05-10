import { InformationCircleIcon } from '@heroicons/react/20/solid'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { de as deLocale } from 'date-fns/locale'
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
import { useDiscussPageLinkParts } from '../../lib/useDiscussPageLinkParts'

function formatLastTouchedRelative(iso: string): string {
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime())) return iso
  return formatDistanceToNow(d, { locale: deLocale, addSuffix: true })
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

  const cardClass =
    'group block rounded-md border border-blue-200 bg-blue-50 p-4 outline-none transition-colors hover:border-blue-300 hover:bg-blue-100 dark:border-slate-700 dark:bg-blue-500/10 dark:hover:border-slate-600 dark:hover:bg-blue-500/[0.18] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500'

  return (
    <div className="space-y-3">
      {items.map((issue) => {
        const stateLabel = issue.state === 'open' ? de.discuss.stateOpen : de.discuss.stateClosed
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
            className={cn(cardClass, 'cursor-pointer')}
          >
            <div className="flex">
              <div className="shrink-0">
                <InformationCircleIcon aria-hidden className="size-5 text-blue-400" />
              </div>
              <div className="ml-3 min-w-0 flex-1 md:flex md:items-start md:justify-between md:gap-6">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {de.discuss.alertTitle}
                  </p>
                  <p className="mt-1 text-xs text-blue-600/85 dark:text-blue-400/75">
                    {statusLine}
                  </p>
                </div>
                <p className="mt-3 shrink-0 text-sm md:mt-0 md:ml-6">
                  <span className="font-medium whitespace-nowrap text-blue-700 group-hover:text-blue-600 dark:text-blue-300 dark:group-hover:text-blue-200">
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
