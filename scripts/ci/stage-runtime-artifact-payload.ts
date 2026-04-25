import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * WHAT: Rebuilds `.artifact-runtime` and copies runtime payload folders (`datasets` and optional `data`) into it.
 * WHY: Creates a stable artifact layout that downstream Pages deploy steps can consume regardless of workspace structure.
 */
const artifactRoot = path.resolve('.artifact-runtime')
rmSync(artifactRoot, { recursive: true, force: true })

const artifactDatasets = path.join(artifactRoot, 'datasets')
const artifactData = path.join(artifactRoot, 'data')
mkdirSync(artifactDatasets, { recursive: true })
mkdirSync(artifactData, { recursive: true })

cpSync(path.resolve('datasets'), artifactDatasets, { recursive: true, force: true })

const dataRoot = path.resolve('data')
if (existsSync(dataRoot)) {
  cpSync(dataRoot, artifactData, { recursive: true, force: true })
}

const rustSidecarMetadata = {
  fingerprint: process.env.RUST_SIDECAR_FINGERPRINT ?? null,
  inputHash: process.env.RUST_SIDECAR_INPUT_HASH ?? null,
  rustcRelease: process.env.RUSTC_RELEASE ?? null,
  rustcVersion: process.env.RUSTC_VERSION ?? null,
  changeStatus: process.env.RUST_SIDECAR_CHANGE_STATUS ?? 'unknown',
  previousFingerprint: process.env.RUST_SIDECAR_PREVIOUS_FINGERPRINT || null,
  cacheHit:
    process.env.RUST_SIDECAR_CACHE_HIT === 'true'
      ? true
      : process.env.RUST_SIDECAR_CACHE_HIT === 'false'
        ? false
        : null,
}

const metadataPath = path.join(artifactRoot, 'rust-sidecar-metadata.json')
writeFileSync(
  metadataPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      rustSidecar: rustSidecarMetadata,
    },
    null,
    2,
  )}\n`,
  { encoding: 'utf-8' },
)
