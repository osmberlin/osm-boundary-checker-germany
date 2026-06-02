/**
 * Commit messages for machine-generated / CI-persisted repo data.
 *
 * Use these subjects (or the same `chore(data):` prefix) for any commit that only
 * updates generated runtime assets. `bun run changelog` ignores all of them via a
 * single flag: `--ignore-commit-term "chore(data):"` in package.json.
 */
export const DATA_COMMIT_MSG_PREFIX = 'chore(data):' as const

/** Nightly CI: datasets snapshots + processing-log.jsonl. */
export const DATA_RUNTIME_HISTORY_COMMIT_MSG =
  `${DATA_COMMIT_MSG_PREFIX} refresh runtime history` as const

/** After report generate-areas when committing areasIndex.gen.ts. */
export const DATA_AREAS_INDEX_COMMIT_MSG = `${DATA_COMMIT_MSG_PREFIX} update areas index` as const

/** After bun run changelog when committing registry + generated changelog files. */
export const DATA_CHANGELOG_COMMIT_MSG = `${DATA_COMMIT_MSG_PREFIX} update changelog` as const

/** After report sync-discussions-registry. */
export const DATA_DISCUSSIONS_REGISTRY_COMMIT_MSG =
  `${DATA_COMMIT_MSG_PREFIX} sync discussions registry` as const

/** After german-key-lookup update / weekly refresh. */
export const DATA_GERMAN_KEY_LOOKUP_COMMIT_MSG =
  `${DATA_COMMIT_MSG_PREFIX} update german-key-lookup` as const
