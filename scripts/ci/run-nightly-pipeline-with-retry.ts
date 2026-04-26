import { spawn } from 'node:child_process'

/**
 * WHAT: Runs a nightly pipeline command with a bounded retry policy.
 * WHY: Nightly refresh can fail on transient network or upstream hiccups; one delayed retry improves success rate without hiding persistent failures.
 */
function normalizeCommand(raw: string[]): string[] {
  if (raw.length === 0) return raw
  if (raw[0] === 'bun') return raw

  const bunLikeFirstArg =
    raw[0].startsWith('-') ||
    raw[0] === 'run' ||
    raw[0] === 'x' ||
    raw[0] === 'pm' ||
    raw[0] === 'install'

  return bunLikeFirstArg ? ['bun', ...raw] : raw
}

function parseArgs(argv: string[]): { command: string[]; label: string } {
  const delimiter = argv.indexOf('--')
  const labelArgIndex = argv.findIndex((part) => part === '--label')
  const hasExplicitCommand = delimiter >= 0
  const commandCandidate = hasExplicitCommand
    ? argv.slice(delimiter + 1)
    : argv.filter((part, index) => !(part === '--label' || index === labelArgIndex + 1))
  const raw = commandCandidate.filter((part) => part.trim().length > 0)

  if (!hasExplicitCommand && raw.length > 0) {
    const normalized = normalizeCommand(raw)
    const label =
      labelArgIndex >= 0 && argv[labelArgIndex + 1]?.trim().length
        ? argv[labelArgIndex + 1].trim()
        : normalized.join(' ')
    return { command: normalized, label }
  }

  if (delimiter === -1) {
    return {
      command: ['bun', 'run', 'pipeline:nightly'],
      label: 'bun run pipeline:nightly',
    }
  }

  if (raw.length === 0) {
    throw new Error('Expected command after "--".')
  }
  const normalized = normalizeCommand(raw)

  const label =
    labelArgIndex >= 0 && argv[labelArgIndex + 1]?.trim().length
      ? argv[labelArgIndex + 1].trim()
      : normalized.join(' ')
  return { command: normalized, label }
}

function runPipeline(command: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const [exec, ...args] = command
    if (!exec) {
      reject(new Error('Missing executable for retry command.'))
      return
    }
    const child = spawn(exec, args, {
      stdio: 'inherit',
      env: process.env,
    })

    child.on('error', (error) => reject(error))
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`pipeline:nightly failed (code=${code}, signal=${signal ?? 'none'})`))
    })
  })
}

async function main(): Promise<void> {
  const { command, label } = parseArgs(process.argv.slice(2))
  const attempts = 2

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await runPipeline(command)
      return
    } catch (error) {
      if (attempt >= attempts) {
        throw error
      }
      const waitSeconds = (attempt + 1) * 30
      console.log(`Retry ${attempt + 1}/${attempts} in ${waitSeconds}s: ${label}`)
      await Bun.sleep(waitSeconds * 1000)
    }
  }
}

await main()
