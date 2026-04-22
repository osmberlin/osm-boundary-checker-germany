import { spawn } from 'node:child_process'

/**
 * WHAT: Runs `bun run pipeline:nightly` with a bounded retry policy.
 * WHY: Nightly refresh can fail on transient network or upstream hiccups; one delayed retry improves success rate without hiding persistent failures.
 */
function runPipeline(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('bun', ['run', 'pipeline:nightly'], {
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
  const attempts = 2

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await runPipeline()
      return
    } catch (error) {
      if (attempt >= attempts) {
        throw error
      }
      const waitSeconds = (attempt + 1) * 30
      console.log(`Retry ${attempt + 1}/${attempts} in ${waitSeconds}s: bun run pipeline:nightly`)
      await Bun.sleep(waitSeconds * 1000)
    }
  }
}

await main()
