import { useState } from 'react'
import { de } from '../../i18n/de'
import { githubNewDiscussIssueUrl } from '../../lib/githubDiscussIssueUrl'
import { useDiscussPageLinkParts } from '../../lib/useDiscussPageLinkParts'
import {
  AppDialogActions,
  AppDialogBody,
  AppDialogDescription,
  AppDialogHeader,
  AppDialogHeaderLeadSlot,
  AppDialogHeaderSeparator,
  AppDialogHeaderTitleSlot,
  AppDialogTitle,
  Dialog,
} from '../ui/Dialog'

type Props = {
  className?: string
}

export function DiscussDatasetButton({ className }: Props) {
  const [open, setOpen] = useState(false)
  const { matchKey, pageUrlAbsolute } = useDiscussPageLinkParts()
  const createUrl = githubNewDiscussIssueUrl({ title: matchKey, body: pageUrlAbsolute })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          'shrink-0 text-xs font-medium text-sky-400 underline decoration-sky-500/50 underline-offset-2 hover:text-sky-300'
        }
      >
        {de.discuss.buttonLabel}
      </button>

      <Dialog open={open} onClose={setOpen} size="lg">
        <AppDialogHeader>
          <AppDialogHeaderTitleSlot>
            <AppDialogTitle>{de.discuss.modalTitle}</AppDialogTitle>
          </AppDialogHeaderTitleSlot>
          <AppDialogHeaderSeparator />
          <AppDialogHeaderLeadSlot>
            <AppDialogDescription>{de.discuss.modalLead}</AppDialogDescription>
          </AppDialogHeaderLeadSlot>
        </AppDialogHeader>
        <AppDialogBody className="space-y-2">
          {de.discuss.modalParagraphs.map((p) => (
            <p key={p} className="m-0 text-sm leading-6 text-slate-300">
              {p}
            </p>
          ))}
        </AppDialogBody>
        <AppDialogActions>
          <button
            type="button"
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 ring-1 ring-white/10 hover:bg-slate-700"
            onClick={() => setOpen(false)}
          >
            {de.discuss.modalClose}
          </button>
          <a
            href={createUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            {de.discuss.openNewIssue}
          </a>
        </AppDialogActions>
      </Dialog>
    </>
  )
}
