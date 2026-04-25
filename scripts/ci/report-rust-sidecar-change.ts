import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

type RustSidecarMetadata = {
  rustSidecar?: {
    fingerprint?: string
  }
}

type ChangeStatus = 'changed' | 'unchanged' | 'unknown'

function appendGithubValue(filePath: string | undefined, key: string, value: string): void {
  if (!filePath) {
    return
  }
  appendFileSync(filePath, `${key}=${value}\n`, { encoding: 'utf-8' })
}

function resolvePreviousFingerprint(metadataPath: string): string | null {
  if (!existsSync(metadataPath)) {
    return null
  }
  const parsed = JSON.parse(readFileSync(metadataPath, 'utf-8')) as RustSidecarMetadata
  return parsed.rustSidecar?.fingerprint?.trim() || null
}

function toSummaryLine(
  changeStatus: ChangeStatus,
  previousFingerprint: string | null,
  currentFingerprint: string,
  cacheHit: string | undefined,
): string {
  const cacheSuffix =
    cacheHit === 'true'
      ? ' Cache: hit.'
      : cacheHit === 'false'
        ? ' Cache: miss.'
        : ' Cache: unknown.'
  if (changeStatus === 'unknown') {
    return `Rust sidecar change status: unknown (no prior metadata found). Current fingerprint: \`${currentFingerprint}\`.${cacheSuffix}`
  }
  if (changeStatus === 'unchanged') {
    return `Rust sidecar unchanged: fingerprint stayed \`${currentFingerprint}\`.${cacheSuffix}`
  }
  return `Rust sidecar changed: previous \`${previousFingerprint}\`, current \`${currentFingerprint}\`.${cacheSuffix}`
}

function run(): void {
  const currentFingerprint = process.env.RUST_SIDECAR_FINGERPRINT?.trim()
  if (!currentFingerprint) {
    throw new Error('RUST_SIDECAR_FINGERPRINT is required.')
  }

  const previousMetadataPath = path.resolve(
    process.env.PREVIOUS_RUST_METADATA_PATH ?? '.previous-artifact/rust-sidecar-metadata.json',
  )
  const previousFingerprint = resolvePreviousFingerprint(previousMetadataPath)

  let changeStatus: ChangeStatus = 'unknown'
  if (previousFingerprint) {
    changeStatus = previousFingerprint === currentFingerprint ? 'unchanged' : 'changed'
  }

  appendGithubValue(process.env.GITHUB_OUTPUT, 'rust_sidecar_change_status', changeStatus)
  appendGithubValue(
    process.env.GITHUB_OUTPUT,
    'rust_sidecar_previous_fingerprint',
    previousFingerprint ?? '',
  )

  appendGithubValue(process.env.GITHUB_ENV, 'RUST_SIDECAR_CHANGE_STATUS', changeStatus)
  appendGithubValue(
    process.env.GITHUB_ENV,
    'RUST_SIDECAR_PREVIOUS_FINGERPRINT',
    previousFingerprint ?? '',
  )

  const summary = toSummaryLine(
    changeStatus,
    previousFingerprint,
    currentFingerprint,
    process.env.RUST_SIDECAR_CACHE_HIT,
  )
  console.log(summary)

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`, { encoding: 'utf-8' })
  }
}

run()
