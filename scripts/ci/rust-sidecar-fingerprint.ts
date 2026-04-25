import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

type FingerprintResult = {
  rustcRelease: string
  rustcVersion: string
  inputHash: string
  fingerprint: string
}

function listFilesRecursive(rootDir: string): string[] {
  const entries = readdirSync(rootDir).sort((a, b) => a.localeCompare(b))
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry)
    const info = statSync(fullPath)
    if (info.isDirectory()) {
      files.push(...listFilesRecursive(fullPath))
      continue
    }
    files.push(fullPath)
  }

  return files
}

function getRustcRelease(): { rustcRelease: string; rustcVersion: string } {
  const versionVerbose = spawnSync('rustc', ['-Vv'], { encoding: 'utf-8' })
  if (versionVerbose.status !== 0) {
    throw new Error(`rustc -Vv failed: ${versionVerbose.stderr || 'unknown error'}`)
  }

  const releaseMatch = versionVerbose.stdout.match(/^release:\s+(.+)$/m)
  if (!releaseMatch?.[1]) {
    throw new Error(`Could not parse rustc release from output: ${versionVerbose.stdout}`)
  }
  const rustcRelease = releaseMatch[1].trim()

  const versionShort = spawnSync('rustc', ['-V'], { encoding: 'utf-8' })
  if (versionShort.status !== 0) {
    throw new Error(`rustc -V failed: ${versionShort.stderr || 'unknown error'}`)
  }

  const parts = versionShort.stdout.trim().split(/\s+/)
  const rustcVersion = parts[1] ?? rustcRelease
  return { rustcRelease, rustcVersion }
}

function computeInputHash(projectRoot: string): string {
  const sidecarRoot = path.join(projectRoot, 'rust', 'geom-sidecar')
  const srcRoot = path.join(sidecarRoot, 'src')

  const requiredFiles = [
    path.join(sidecarRoot, 'Cargo.toml'),
    path.join(sidecarRoot, 'Cargo.lock'),
    ...listFilesRecursive(srcRoot),
  ]

  const hash = createHash('sha256')
  for (const fullPath of requiredFiles) {
    const relPath = path.relative(projectRoot, fullPath).replaceAll(path.sep, '/')
    hash.update(relPath)
    hash.update('\0')
    hash.update(readFileSync(fullPath))
    hash.update('\0')
  }
  return hash.digest('hex')
}

function appendGithubValue(filePath: string | undefined, key: string, value: string): void {
  if (!filePath) {
    return
  }
  appendFileSync(filePath, `${key}=${value}\n`, { encoding: 'utf-8' })
}

function run(): FingerprintResult {
  const projectRoot = process.cwd()
  const { rustcRelease, rustcVersion } = getRustcRelease()
  const inputHash = computeInputHash(projectRoot)

  const fingerprintHash = createHash('sha256')
  fingerprintHash.update(`rustc:${rustcRelease}\n`)
  fingerprintHash.update(`input:${inputHash}\n`)
  const fingerprint = fingerprintHash.digest('hex')

  appendGithubValue(process.env.GITHUB_OUTPUT, 'rustc_release', rustcRelease)
  appendGithubValue(process.env.GITHUB_OUTPUT, 'rustc_version', rustcVersion)
  appendGithubValue(process.env.GITHUB_OUTPUT, 'rust_sidecar_input_hash', inputHash)
  appendGithubValue(process.env.GITHUB_OUTPUT, 'rust_sidecar_fingerprint', fingerprint)

  appendGithubValue(process.env.GITHUB_ENV, 'RUSTC_RELEASE', rustcRelease)
  appendGithubValue(process.env.GITHUB_ENV, 'RUSTC_VERSION', rustcVersion)
  appendGithubValue(process.env.GITHUB_ENV, 'RUST_SIDECAR_INPUT_HASH', inputHash)
  appendGithubValue(process.env.GITHUB_ENV, 'RUST_SIDECAR_FINGERPRINT', fingerprint)

  return { rustcRelease, rustcVersion, inputHash, fingerprint }
}

const result = run()
console.log(
  JSON.stringify(
    {
      rustcRelease: result.rustcRelease,
      rustcVersion: result.rustcVersion,
      rustSidecarInputHash: result.inputHash,
      rustSidecarFingerprint: result.fingerprint,
    },
    null,
    2,
  ),
)
