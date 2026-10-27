import { Fragment } from 'react'
import { wikidataItemUrl } from '../lib/regionalHubQuickStatements'

/** Same text color as the surrounding value; only the underline marks the link (like other external links). */
const WIKIDATA_LINK_CLASS =
  'underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'
const QID_PATTERN = /^Q\d+$/

/**
 * Value text of a tag or property. For the `wikidata` key every semicolon-separated QID links to
 * its Wikidata item; other keys and values that are not a QID stay plain text.
 */
export function TagValue({ tagKey, value }: { tagKey: string; value: string }) {
  if (tagKey !== 'wikidata') return value
  return value.split(';').map((part, index) => {
    const separator = index > 0 ? ';' : null
    const qid = part.trim()
    if (!QID_PATTERN.test(qid)) {
      return (
        <Fragment key={index}>
          {separator}
          {part}
        </Fragment>
      )
    }
    const start = part.indexOf(qid)
    const leading = part.slice(0, start)
    const trailing = part.slice(start + qid.length)
    return (
      <Fragment key={index}>
        {separator}
        {leading}
        <a
          href={wikidataItemUrl(qid)}
          target="_blank"
          rel="noreferrer"
          className={WIKIDATA_LINK_CLASS}
        >
          {qid}
        </a>
        {trailing}
      </Fragment>
    )
  })
}

/** One `key=value` text (as used in copyable tag hints); only the value part is linked. */
export function TagPairText({ pair }: { pair: string }) {
  const index = pair.indexOf('=')
  if (index === -1) return pair
  const key = pair.slice(0, index)
  return (
    <>
      {key}={<TagValue tagKey={key} value={pair.slice(index + 1)} />}
    </>
  )
}
