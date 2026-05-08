import { styleText } from 'node:util'

/** Section / step title (cyan + bold). */
export function cliHeadline(text: string): string {
  return styleText(['bold', 'cyan'], text)
}

/** Success / completion. */
export function cliOk(text: string): string {
  return styleText('green', text)
}

export function cliWarn(text: string): string {
  return styleText('yellow', text)
}

export function cliErr(text: string): string {
  return styleText('red', text)
}

/** Secondary detail (timings, dry-run hints). */
export function cliMuted(text: string): string {
  return styleText('dim', text)
}
