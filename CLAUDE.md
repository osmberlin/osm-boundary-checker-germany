# Notes for Claude

## Generated files: never commit local copies

Local runs (`bun run compare`, `extract:official`, `report` `predev` / `sync-runtime-assets`) rewrite these tracked files. CI produces the real versions, so leave local changes to them out of every commit and restore them with `git restore <path>` when the user agrees:

- `datasets/*/snapshots.json`: chart history, committed by CI as `chore(data): refresh runtime history` ([docs/cache-policy.md](docs/cache-policy.md)). A local compare appends a snapshot that would clash with CI.
- `datasets/*/source/metadata.json`: download timestamps of the local source cache.
- `data/processing-log.jsonl`: `/status` pipeline timeline, appended by every `scripts/pipeline/nightly.ts` run and committed by CI the same way.
- `report/src/data/areasIndex.gen.ts`: built by `report/generateAreasIndex.ts` in `sync-runtime-assets` before every deploy (`.github/workflows/pages-deploy.yml`, `data-refresh.yml`).
- `report/public/discussions.registry.json`: fetched from GitHub issues by `report/syncDiscussionsRegistry.ts` in the same step ([docs/discussion-issues.md](docs/discussion-issues.md)).

Commit one of them only when a code change needs a new committed baseline and the user asked for it. Stage files by explicit path, never with `git add -A` or `git commit -a`.

## Changelog

`changelog.registry.yaml` needs an entry (German `descriptionMd`, or `hide: true`) for every commit that is not `chore(data):` and has no `hide changelog` line in its body; the pre-push hook checks this. Add entries before pushing, and do not amend afterwards.

Other sessions may commit in this checkout at the same time: check `git log` before amending, and amend only a commit you just made.
