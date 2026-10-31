import { queryOptions } from '@tanstack/react-query'
import { changelogFileSchema, type ChangelogFile } from '@tordans/changelog-kit/schemas'
import { arsSuccessorTableSchema } from '../../../scripts/shared/arsSuccessorTable.ts'
import {
  comparisonForReportSchema,
  featureDetailShardSchema,
  snapshotsSchema,
} from '../../../scripts/shared/comparisonPayload.ts'
import {
  discussionRegistryFileSchema,
  emptyDiscussionRegistryFile,
  type DiscussionRegistryFile,
} from '../../../scripts/shared/discussionsRegistry.ts'
import {
  discussionRegistrySyncMetaSchema,
  type DiscussionRegistrySyncMeta,
} from '../../../scripts/shared/discussionsRegistrySyncMeta.ts'
import { germanKeyLookupBundleSchema } from '../../../scripts/shared/germanKeyLookupPayload.ts'
import type { GermanKeyLookupBundle } from '../../../scripts/shared/germanKeyLookupPayload.ts'
import {
  regionalHubManifestSchema,
  regionalHubMismatchFlagsFileSchema,
  regionalHubOsmTagsFileSchema,
  regionalHubWikidataFileSchema,
} from '../../../scripts/shared/regionalHubPayload.ts'
import type { WikidataShard } from '../../../scripts/shared/wikidataProtectedAreasPayload.ts'
import { textPreview } from '../lib/textPreview'
import {
  extractWfsErrorMessage,
  fetchWfsGetFeature,
  parseWfsFeatures,
  type WfsFeature,
} from '../lib/wfsGetFeature'
import type {
  AttributeHint,
  CandidateMatch,
  ComparisonForReport,
  FeatureDetailShard,
  SnapshotsJson,
} from '../types/report'
import { runStatusFileSchema, type RunStatusFile } from '../types/runStatus'
import {
  changelogUrl,
  comparisonApiUrl,
  discussionsRegistryUrl,
  discussionsRegistrySyncMetaUrl,
  featureApiUrl,
  arsSuccessorsUrl,
  germanKeyLookupUrl,
  regionalHubManifestUrl,
  regionalHubMismatchFlagsUrl,
  regionalHubOsmTagsUrl,
  regionalHubWikidataUrl,
  runStatusUrl,
  snapshotsUrl,
} from './paths'

async function readJsonStrict(url: string, response: Response): Promise<unknown> {
  const bodyText = await response.text()
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if (!contentType.includes('application/json')) {
    const preview = textPreview(bodyText)
    throw new Error(
      `Expected JSON from ${url}, got content-type "${contentType || 'unknown'}" (starts with: ${JSON.stringify(
        preview,
      )}). Run compare and sync static runtime assets before dev.`,
    )
  }
  try {
    const raw: unknown = JSON.parse(bodyText)
    return raw
  } catch (error) {
    const preview = textPreview(bodyText)
    throw new Error(
      `Invalid JSON from ${url} (starts with: ${JSON.stringify(preview)}): ${String(error)}`,
    )
  }
}

export async function loadComparison(area: string): Promise<ComparisonForReport> {
  const url = comparisonApiUrl(area)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return comparisonForReportSchema.parse(await readJsonStrict(url, r))
}

export async function loadFeatureShard(
  area: string,
  featureKey: string,
): Promise<FeatureDetailShard> {
  const url = featureApiUrl(area, featureKey)
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return featureDetailShardSchema.parse(await readJsonStrict(url, r))
}

export async function loadSnapshots(area: string): Promise<SnapshotsJson | null> {
  const url = snapshotsUrl(area)
  const r = await fetch(url)
  if (!r.ok) return null
  return snapshotsSchema.parse(await readJsonStrict(url, r))
}

export async function loadGermanKeyLookup(): Promise<GermanKeyLookupBundle> {
  const url = germanKeyLookupUrl()
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  return germanKeyLookupBundleSchema.parse(await readJsonStrict(url, r))
}

export async function loadArsSuccessorTable() {
  const url = arsSuccessorsUrl()
  const r = await fetch(url)
  if (!r.ok) return null
  const parsed = arsSuccessorTableSchema.safeParse(await readJsonStrict(url, r))
  return parsed.success ? parsed.data : null
}

export async function loadRunStatus(): Promise<RunStatusFile | null> {
  const url = runStatusUrl()
  const r = await fetch(url)
  if (!r.ok) return null
  const parsed = runStatusFileSchema.safeParse(await readJsonStrict(url, r))
  return parsed.success ? parsed.data : null
}

export async function loadChangelog(): Promise<ChangelogFile | null> {
  const url = changelogUrl()
  const r = await fetch(url)
  if (!r.ok) return null
  const parsed = changelogFileSchema.safeParse(await readJsonStrict(url, r))
  return parsed.success ? parsed.data : null
}

export async function loadDiscussionsRegistry(): Promise<DiscussionRegistryFile> {
  const url = discussionsRegistryUrl()
  const r = await fetch(url)
  if (!r.ok) return emptyDiscussionRegistryFile()
  try {
    const parsed = discussionRegistryFileSchema.safeParse(await readJsonStrict(url, r))
    return parsed.success ? parsed.data : emptyDiscussionRegistryFile()
  } catch {
    return emptyDiscussionRegistryFile()
  }
}

export async function loadDiscussionsRegistrySyncMeta(): Promise<DiscussionRegistrySyncMeta | null> {
  const url = discussionsRegistrySyncMetaUrl()
  const r = await fetch(url)
  if (!r.ok) return null
  try {
    const parsed = discussionRegistrySyncMetaSchema.safeParse(await readJsonStrict(url, r))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * Compose result of `loadFeatureOrFallback`. We intentionally surface `candidates` next to
 * the comparison payload (rather than burying it in `rows[0]`) because the candidates are
 * shard-only data — see Step 3 of the official-only candidates plan: keeping
 * `comparison_table.json` lean.
 */
export type FeatureDetailComparison = ComparisonForReport & {
  candidates?: CandidateMatch[]
  attributeHints?: AttributeHint[]
  wikidata?: WikidataShard
}

export async function loadFeatureOrFallback(
  area: string,
  featureKey: string,
  /** Source of the comparison table; the query cache, so pages that also show it fetch it once. */
  getComparison: (area: string) => Promise<ComparisonForReport> = loadComparison,
): Promise<FeatureDetailComparison> {
  // Both requests at once: the table is large for some datasets, the shard is tiny.
  const shardRequest = loadFeatureShard(area, featureKey)
  shardRequest.catch(() => {})
  const comparison = await getComparison(area)
  try {
    const shard = await shardRequest
    return {
      ...comparison,
      rows: [shard.row],
      unmatchedOsm: [],
      ...(shard.candidates !== undefined ? { candidates: shard.candidates } : {}),
      ...(shard.attributeHints !== undefined ? { attributeHints: shard.attributeHints } : {}),
      ...(shard.wikidata !== undefined ? { wikidata: shard.wikidata } : {}),
    }
  } catch (shardError) {
    const matchedRow = comparison.rows.find((row) => row.canonicalMatchKey === featureKey)
    if (matchedRow) {
      return {
        ...comparison,
        rows: [matchedRow],
        unmatchedOsm: [],
      }
    }
    const hasUnmatched = comparison.unmatchedOsm.some((row) => row.canonicalMatchKey === featureKey)
    if (hasUnmatched) return comparison
    throw shardError
  }
}

export function comparisonQueryOptions(area: string) {
  return queryOptions({
    queryKey: ['comparison', area],
    queryFn: () => loadComparison(area),
  })
}

export function snapshotsQueryOptions(area: string) {
  return queryOptions({
    queryKey: ['snapshots', area],
    queryFn: () => loadSnapshots(area),
  })
}

export function featureQueryOptions(area: string, featureKey: string) {
  return queryOptions({
    queryKey: ['feature', area, featureKey],
    queryFn: ({ client }) =>
      loadFeatureOrFallback(area, featureKey, () =>
        client.ensureQueryData(comparisonQueryOptions(area)),
      ),
  })
}

export function runStatusQueryOptions() {
  return queryOptions({
    queryKey: ['run-status'],
    queryFn: () => loadRunStatus(),
  })
}

export function germanKeyLookupQueryOptions() {
  return queryOptions({
    queryKey: ['german-key-lookup'],
    queryFn: () => loadGermanKeyLookup(),
  })
}

async function loadOptionalParsed<T>(url: string, parse: (raw: unknown) => T) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`)
  const contentType = (r.headers.get('content-type') ?? '').toLowerCase()
  // Vite SPA fallback (and some static hosts) return HTML 200 for missing files.
  if (!contentType.includes('application/json')) return null
  return parse(await readJsonStrict(url, r))
}

export async function loadRegionalHubManifest() {
  return loadOptionalParsed(regionalHubManifestUrl(), (raw) => regionalHubManifestSchema.parse(raw))
}

export async function loadRegionalHubOsmTags() {
  return loadOptionalParsed(regionalHubOsmTagsUrl(), (raw) =>
    regionalHubOsmTagsFileSchema.parse(raw),
  )
}

export async function loadRegionalHubWikidata() {
  return loadOptionalParsed(regionalHubWikidataUrl(), (raw) =>
    regionalHubWikidataFileSchema.parse(raw),
  )
}

export async function loadRegionalHubMismatchFlags() {
  return loadOptionalParsed(regionalHubMismatchFlagsUrl(), (raw) =>
    regionalHubMismatchFlagsFileSchema.parse(raw),
  )
}

export function regionalHubManifestQueryOptions() {
  return queryOptions({
    queryKey: ['regional-hub-manifest'],
    queryFn: loadRegionalHubManifest,
    refetchOnMount: 'always',
  })
}

export function regionalHubOsmTagsQueryOptions() {
  return queryOptions({
    queryKey: ['regional-hub-osm-tags'],
    queryFn: loadRegionalHubOsmTags,
    refetchOnMount: 'always',
  })
}

export function regionalHubWikidataQueryOptions() {
  return queryOptions({
    queryKey: ['regional-hub-wikidata'],
    queryFn: loadRegionalHubWikidata,
    refetchOnMount: 'always',
  })
}

export function regionalHubMismatchFlagsQueryOptions() {
  return queryOptions({
    queryKey: ['regional-hub-mismatch-flags'],
    queryFn: loadRegionalHubMismatchFlags,
    refetchOnMount: 'always',
  })
}

export function arsSuccessorsQueryOptions() {
  return queryOptions({
    queryKey: ['ars-successors'],
    queryFn: () => loadArsSuccessorTable(),
  })
}

export function changelogQueryOptions() {
  return queryOptions({
    queryKey: ['changelog'],
    queryFn: loadChangelog,
  })
}

export function discussionsRegistryQueryOptions() {
  return queryOptions({
    queryKey: ['discussions-registry'],
    queryFn: loadDiscussionsRegistry,
  })
}

export function discussionsRegistrySyncMetaQueryOptions() {
  return queryOptions({
    queryKey: ['discussions-registry-sync-meta'],
    queryFn: loadDiscussionsRegistrySyncMeta,
  })
}

export type WfsLiveQueryInput = {
  featureKey: string
  sourceId: string
  requestUrl: string
}

export type WfsLiveQueryData = {
  featureKey: string
  sourceId: string
  features: WfsFeature[]
}

export function wfsLiveQueryOptions(input: WfsLiveQueryInput) {
  return queryOptions({
    queryKey: ['wfs-live', input.featureKey, input.sourceId, input.requestUrl],
    queryFn: async (): Promise<WfsLiveQueryData> => {
      const res = await fetchWfsGetFeature(input.requestUrl)
      const text = await res.text()
      if (!res.ok) {
        const details = extractWfsErrorMessage(text)
        throw new Error(
          details != null && details !== ''
            ? `WFS request failed: ${res.status} (${details})`
            : `WFS request failed: ${res.status}`,
        )
      }
      const features = parseWfsFeatures(text)
      return {
        featureKey: input.featureKey,
        sourceId: input.sourceId,
        features,
      }
    },
  })
}
