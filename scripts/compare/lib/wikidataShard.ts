import type {
  WikidataProtectedAreaItem,
  WikidataShard,
  WikidataShardItem,
} from '../../shared/wikidataProtectedAreasPayload.ts'

const QID = /Q[1-9]\d*/

/** First Wikidata item id in a property value (`Q883905`, or `Q1;Q2` for several). */
function qidFromValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  return QID.exec(raw)?.[0] ?? null
}

function shardItem(
  qid: string,
  byQid: Readonly<Record<string, WikidataProtectedAreaItem>>,
): WikidataShardItem {
  const item = byQid[qid]
  return item ? { qid, ...item } : { qid, notFound: true }
}

/**
 * Wikidata block of a feature shard: the item that the official `wikidata` property names and,
 * when it is another one, the item of the OSM `wikidata` tag. `{}` when neither names an item.
 */
export function wikidataShardForRow(
  officialProperties: Record<string, unknown> | null,
  osmProperties: Record<string, unknown> | null,
  byQid: Readonly<Record<string, WikidataProtectedAreaItem>>,
): WikidataShard {
  const officialQid = qidFromValue(officialProperties?.wikidata)
  const osmQid = qidFromValue(osmProperties?.wikidata)
  return {
    ...(officialQid ? { official: shardItem(officialQid, byQid) } : {}),
    ...(osmQid && osmQid !== officialQid ? { osm: shardItem(osmQid, byQid) } : {}),
  }
}
