# SIGTERM / SIGINT Debug Runbook

Use this runbook after the compare instrumentation changes to classify termination causes.

## 1) Capture a baseline run

1. Trigger `Refresh Datasets`.
2. Do not trigger another run until it finishes.
3. Export logs:

```bash
gh run list --workflow "data-refresh.yml" -L 5
gh run view <run_id> --repo osmberlin/osm-boundary-checker-germany --log > "run-<run_id>.log"
```

## 2) Capture an overlap/cancellation run

1. Trigger `Refresh Datasets`.
2. While it is running, trigger it again (concurrency cancellation path).
3. Export both logs as above.

## 3) Inspect compare JSONL checkpoints

From workflow artifacts, inspect `data/internal-compare-timing.jsonl`:

- `compare_checkpoint` shows stage boundaries.
- `compare_progress` shows in-loop progress for projection/shards.
- `compare_signal` shows last checkpoint and in-flight phase on signal.
- `compare_run_end` should appear exactly once per area/run attempt.

## 4) Classify failure cause

Classify using combined evidence (`run-<id>.log` + compare JSONL + workflow summary diagnostics):

- **Concurrency/manual cancellation**
  - runner shutdown/cancel wording
  - `SIGTERM` / exit `143`
  - overlapping newer run in “Recent data-refresh runs” summary block
- **Runtime/data fault**
  - explicit thrown error stack before termination
  - deterministic checkpoint where failure repeats
  - non-143 exit more likely
- **Resource/runner pressure**
  - abrupt `SIGTERM` without overlap
  - repeated termination near same long-running checkpoint
  - optional runner-level OOM/kill hints in raw logs

## 5) Evidence checklist for incident notes

- workflow `run_id`, `run_attempt`
- compare `runId` (internal JSONL)
- last `compare_checkpoint`
- last `compare_progress` counters
- `compare_signal` payload (`signal`, `lastCheckpoint`, `inFlightPhase`, `elapsedMs`)
- `compare_run_end` payload
