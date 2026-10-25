import { useState } from 'react'
import { de } from '../../i18n/de'
import { sharedButtonTinyClass } from '../sharedButtonStyles'

/** Copies `key=value` lines (one per tag) to the clipboard; the label flips to "Kopiert" briefly. */
export function CopyTagsButton({
  tags,
  ariaLabel,
}: {
  tags: Record<string, string>
  ariaLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const text = Object.entries(tags)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
  if (text.length === 0) return null

  const copy = () => {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        // Clipboard access can be denied; the tags stay visible next to the button.
      })
  }

  return (
    <button type="button" className={sharedButtonTinyClass} onClick={copy} aria-label={ariaLabel}>
      {copied ? de.feature.copyTagsDone : de.feature.copyTags}
    </button>
  )
}
