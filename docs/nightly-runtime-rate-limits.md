# Nightly runtime, GitHub limits, and no-cost optimization

This note explains whether a ~3 hour nightly pipeline is a problem for an open-source GitHub project, what limits actually matter, and how to optimize without paid infrastructure or external processing tools.

## Short answer

- A 3 hour nightly run is generally acceptable for a public open-source repository on GitHub Actions.
- On public repos, standard GitHub-hosted runners are free to use.
- The key constraint is job/runtime and service limits, not minute billing.
- Your current workflow is still below the common GitHub-hosted job timeout (6 hours per job), but you have less headroom for retries or future growth.

## What matters in practice

### 1) GitHub Actions platform limits

- Standard GitHub-hosted runner jobs time out at 6 hours.
- Workflow run time has an upper bound (much larger than this pipeline), so day-to-day bottlenecks are usually per-job limits and queueing.
- Public repos can use standard GitHub-hosted runners without minute charges.
- Larger runners are billed, even for public repos.

Implication for this project:

- A 3 hour single-job nightly run is not automatically an issue.
- It becomes fragile when retries, larger datasets, or upstream slowness push runs toward 6 hours.

### 2) GitHub API limits (if/when automation calls API endpoints)

- Unauthenticated REST API: low hourly quota (commonly 60 requests/hour per IP).
- Authenticated REST API: much higher quota (commonly 5,000 requests/hour).
- `GITHUB_TOKEN` has its own per-repository limits.
- Secondary limits also exist (for example too much concurrency/burst behavior).

Common know-how:

- Prefer authenticated requests.
- Avoid high parallel API bursts.
- Honor `retry-after`, `x-ratelimit-reset`, and use exponential backoff.
- Use conditional requests (`ETag`, `If-Modified-Since`) when polling metadata.

### 3) Upstream data providers (often the real bottleneck)

For this pipeline, runtime is more likely dominated by:

- OSM PBF download + extraction.
- Per-area compare execution and tile generation.
- Official source endpoints (WFS/HTTP) response speed and reliability.

These external endpoints can be slower or stricter than GitHub itself, so respectful retry/backoff and smart refresh cadence matter.

## Project-specific observations

Current behavior already helps:

- Workflow has `concurrency` to avoid overlap (`cancel-in-progress: true`).
- Scheduled refresh runs now happen four times per week (Wed/Fri/Sat/Sun at 03:00 UTC), reducing unnecessary daily load while keeping weekend freshness.
- Download/compare steps include retry wrappers in `.github/workflows/data-refresh.yml`.

Current behavior that still drives long runtime:

- OSM extract and per-area compares still dominate runtime; OSM/BKG/official downloads now follow a daily refresh window and reuse cache within the same window.
- Area compares run sequentially.

## No-cost optimization playbook (stay on GitHub, no paid tools)

Start with these, in order:

1. Add timing breakdown per step and per area to each run summary.
2. Skip OSM re-download if source file is unchanged (HTTP conditional fetch or timestamp check).
3. Skip OSM extract if input PBF is unchanged.
4. Add "changed-area only" compare mode for routine runs to reduce compare runtime.
5. Keep heavy retries bounded (already present) and fail fast on persistent upstream errors.
6. Consider splitting into multiple jobs only when needed, and keep each job under 6h with margin.

### Suggested operating model

- Scheduled (Wed/Fri/Sat/Sun): full refresh + full compare.
- Manual dispatch: full rebuild for verification or release snapshots.

This preserves data freshness while reducing nightly runtime and operational risk.

## Deciding if 3 hours is "too long"

Use this simple rule:

- Fine: stable success rate, low retry count, stays comfortably below 6 hours.
- Needs action: frequent timeout/retry cascades, long queue delays, or growth trend toward 5-6 hours.

For this repo, 3 hours is workable today, but optimization is still worthwhile to increase reliability and reduce pressure on upstream services.

## References

- [GitHub Actions billing](https://docs.github.com/en/billing/managing-billing-for-github-actions)
- [Billing and usage for GitHub Actions](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [Actions limits](https://docs.github.com/en/actions/reference/usage-limits-for-self-hosted-runners)
- [REST API rate limits](https://docs.github.com/en/rest/overview/rate-limits-for-the-rest-api)
- [REST API best practices](https://docs.github.com/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
