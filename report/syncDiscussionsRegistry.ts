/**
 * Fetches GitHub issues labeled `discussion` and writes `public/discussions.registry.json`.
 * On successful fetch also writes `public/discussions.registry.sync-meta.json` (gitignored)
 * with `registryCheckedAt` for the UI; removes that file when the fetch fails.
 *
 * Run as part of `sync-runtime-assets` (report pipeline only).
 *
 * Matching in the app uses issue title only; `match` is the normalized title.
 * `lastTouchedAt` is GitHub's issue `updated_at` (ISO 8601).
 */
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  discussionRegistryFileSchema,
  emptyDiscussionRegistryFile,
  type DiscussionRegistryFile,
} from '../scripts/shared/discussionsRegistry.ts'
import {
  discussionRegistrySyncMetaSchema,
  type DiscussionRegistrySyncMeta,
} from '../scripts/shared/discussionsRegistrySyncMeta.ts'
import { normalizeDiscussMatchString } from '../scripts/shared/discussMatch.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_FILE = join(__dirname, 'public', 'discussions.registry.json')
const OUT_SYNC_META = join(__dirname, 'public', 'discussions.registry.sync-meta.json')

const OWNER = 'osmberlin'
const REPO = 'osm-boundary-checker-germany'
const LABEL = 'discussion'

type GitHubIssueListItem = {
  number: number
  title: string
  html_url: string
  state: string
  updated_at: string
  pull_request?: unknown
}

function authHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN?.trim()
  if (!token) return {}
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function fetchAllLabeledIssues(): Promise<GitHubIssueListItem[]> {
  const out: GitHubIssueListItem[] = []
  for (let page = 1; page <= 20; page += 1) {
    const u = new URL(`https://api.github.com/repos/${OWNER}/${REPO}/issues`)
    u.searchParams.set('labels', LABEL)
    u.searchParams.set('state', 'all')
    u.searchParams.set('per_page', '100')
    u.searchParams.set('page', String(page))

    const res = await fetch(u.toString(), { headers: authHeaders() })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GitHub issues API ${res.status}: ${text.slice(0, 500)}`)
    }
    const batch = (await res.json()) as GitHubIssueListItem[]
    if (!Array.isArray(batch) || batch.length === 0) break
    out.push(...batch)
    if (batch.length < 100) break
  }
  return out.filter((item) => item.pull_request == null)
}

function buildRegistry(issues: GitHubIssueListItem[]): DiscussionRegistryFile {
  const rows = issues.map((issue) => ({
    match: normalizeDiscussMatchString(issue.title),
    number: issue.number,
    url: issue.html_url,
    state: issue.state === 'open' ? ('open' as const) : ('closed' as const),
    lastTouchedAt: issue.updated_at,
  }))
  rows.sort((a, b) => a.number - b.number)
  return { issues: rows }
}

function readExistingRegistry(): DiscussionRegistryFile | null {
  if (!existsSync(OUT_FILE)) return null
  try {
    const raw = JSON.parse(readFileSync(OUT_FILE, 'utf8')) as unknown
    const parsed = discussionRegistryFileSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

function stableStringify(data: DiscussionRegistryFile): string {
  return `${JSON.stringify(data, null, 2)}\n`
}

function stableSyncMetaStringify(meta: DiscussionRegistrySyncMeta): string {
  const validated = discussionRegistrySyncMetaSchema.parse(meta)
  return `${JSON.stringify(validated, null, 2)}\n`
}

async function main(): Promise<void> {
  let next: DiscussionRegistryFile
  let fetchSucceeded = false
  try {
    const rawIssues = await fetchAllLabeledIssues()
    next = buildRegistry(rawIssues)
    fetchSucceeded = true
  } catch (err) {
    console.error('[syncDiscussionsRegistry] fetch failed:', err)
    const existing = readExistingRegistry()
    next = existing ?? emptyDiscussionRegistryFile()
    if (existing == null) {
      console.error('[syncDiscussionsRegistry] no existing registry; wrote empty issues list')
    } else {
      console.error('[syncDiscussionsRegistry] kept existing registry on failure')
    }
  }

  const parsed = discussionRegistryFileSchema.parse(next)
  writeFileSync(OUT_FILE, stableStringify(parsed), 'utf8')
  console.log(
    `[syncDiscussionsRegistry] wrote ${parsed.issues.length} issue(s) to discussions.registry.json`,
  )

  if (fetchSucceeded) {
    writeFileSync(
      OUT_SYNC_META,
      stableSyncMetaStringify({ registryCheckedAt: new Date().toISOString() }),
      'utf8',
    )
    console.log('[syncDiscussionsRegistry] wrote discussions.registry.sync-meta.json')
  } else if (existsSync(OUT_SYNC_META)) {
    unlinkSync(OUT_SYNC_META)
    console.error('[syncDiscussionsRegistry] removed stale discussions.registry.sync-meta.json')
  }
}

await main()
