#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

/** Destatis quarterly Gemeinde ZIPs (GV100ADQ). We pick the newest snapshot date from file names. */
const DESTATIS_GV100ADQ_ZIP_URLS = [
  'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADQ/GV100AD1QAktuell.zip?__blob=publicationFile&v=17',
  'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADQ/GV100AD2QAktuell.zip?__blob=publicationFile&v=14',
  'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADQ/GV100AD3QAktuell.zip?__blob=publicationFile&v=16',
  'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADQ/GV100AD4QAktuell.zip?__blob=publicationFile&v=15',
] as const

const GENERATED_MODULE_RELATIVE_PATH = 'report/src/data/germanKeyLookup.gen.ts'

type PublicationSource = {
  downloadUrl: string
  archiveEntry: string
  snapshotDate: string
}

/** GV100AD administrative TXT row parsed fields (positions follow Satz layout after snapshot date). */
type MunicipalityWorkbookRow = {
  satzart: string
  snapshotDateRaw: string
  land: string
  rb: string
  kreis: string
  /** Gemeindeverband (4 digits). Canonical ARS order places this before Gemeinde suffix. */
  vb: string
  /** Gemeinde suffix within VG (3 digits). File stores GGG immediately after Kreis, then VVVV. */
  gem: string
  name: string
}

type QuarterlySourceCandidate = PublicationSource & {
  textFileBuffer: Buffer
}

type GeneratedGermanKeyLookup = {
  checkedAt: string
  generatedAt: string
  source: PublicationSource
  bundeslaender: Record<string, string>
  regierungsbezirke: Record<string, string>
  kreise: Record<string, string>
  gemeindeverbaende: Record<string, string>
  gemeindenByAgs: Record<string, string>
  gemeindenByArs: Record<string, string>
}

function logLine(message: string, meta: Record<string, string | number | undefined> = {}): void {
  const suffix = Object.entries(meta)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
  console.log(
    suffix ? `[german-key-lookup] ${message} ${suffix}` : `[german-key-lookup] ${message}`,
  )
}

function parseArgs(argv: string[]) {
  return {
    weekly: argv.includes('--weekly'),
    force: argv.includes('--force'),
  }
}

function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

async function readExistingCheckedAt(generatedAbsPath: string): Promise<string | undefined> {
  if (!existsSync(generatedAbsPath)) return undefined
  try {
    const mod = (await import(`${pathToFileURL(generatedAbsPath).href}?t=${Date.now()}`)) as {
      default?: { checkedAt?: string }
    }
    return mod.default?.checkedAt
  } catch (error) {
    logLine('existing generated module unreadable, forcing refresh', {
      detail: String(error),
    })
    return undefined
  }
}

function normalizeDigits(value: string, length: number): string {
  const digits = value.replace(/\D/g, '')
  if (digits === '') return ''.padStart(length, '0')
  return digits.padStart(length, '0').slice(-length)
}

/** Builds canonical 12-digit ARS (VVVV after Kreis, then GGG). Source rows carry GGG+VVVV. */
function makeArs12(row: MunicipalityWorkbookRow): string {
  return [
    normalizeDigits(row.land, 2),
    normalizeDigits(row.rb, 1),
    normalizeDigits(row.kreis, 2),
    normalizeDigits(row.vb, 4),
    normalizeDigits(row.gem, 3),
  ].join('')
}

function makeAgs8(row: MunicipalityWorkbookRow): string {
  return [
    normalizeDigits(row.land, 2),
    normalizeDigits(row.rb, 1),
    normalizeDigits(row.kreis, 2),
    normalizeDigits(row.gem, 3),
  ].join('')
}

function setLookupValue(
  target: Map<string, string>,
  key: string,
  value: string,
  scope: string,
): void {
  const trimmed = value.trim()
  if (key.trim() === '' || trimmed === '') return
  const prev = target.get(key)
  if (prev !== undefined && prev !== trimmed) {
    void scope
    return
  }
  target.set(key, trimmed)
}

function sortedObject(map: Map<string, string>): Record<string, string> {
  return Object.fromEntries(
    [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true })),
  )
}

async function downloadBuffer(downloadUrl: string): Promise<Buffer> {
  logLine('downloading official source', { downloadUrl })
  const response = await fetch(downloadUrl)
  if (!response.ok) {
    throw new Error(`Failed to download source file: HTTP ${response.status}`)
  }
  const buf = Buffer.from(await response.arrayBuffer())
  logLine('download complete', { bytes: buf.length })
  return buf
}

type ParsedLookupTables = Omit<GeneratedGermanKeyLookup, 'source'>

function parseDdMmYyyy(raw: string): Date | null {
  if (!/^\d{8}$/.test(raw)) return null
  const day = Number(raw.slice(0, 2))
  const month = Number(raw.slice(2, 4))
  const year = Number(raw.slice(4, 8))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

function parseGv100AdTxtRows(buffer: Buffer): MunicipalityWorkbookRow[] {
  const utf8Text = new TextDecoder('utf-8').decode(buffer)
  const text = utf8Text.includes('\uFFFD') ? new TextDecoder('latin1').decode(buffer) : utf8Text
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  return lines.map((line) => ({
    satzart: line.slice(0, 2),
    snapshotDateRaw: line.slice(2, 10),
    land: line.slice(10, 12),
    rb: line.slice(12, 13),
    kreis: line.slice(13, 15),
    /** Gemeinde innerhalb VG (3); Satz 50 pads with spaces — normalized later when unused. */
    gem: line.slice(15, 18),
    /** Gemeindeverband (4); aligns after gem block (spaces before VG key on Satz 50). */
    vb: line.slice(18, 22),
    name: line.slice(22, 72),
  }))
}

async function resolveLatestQuarterlySource(): Promise<QuarterlySourceCandidate> {
  const candidates: QuarterlySourceCandidate[] = []
  for (const downloadUrl of DESTATIS_GV100ADQ_ZIP_URLS) {
    const zipBuffer = await downloadBuffer(downloadUrl)
    const archive = await JSZip.loadAsync(zipBuffer)
    const txtEntry = Object.values(archive.files).find((entry) =>
      /^GV100AD_\d{8}\.txt$/i.test(entry.name),
    )
    if (!txtEntry) {
      throw new Error(`ZIP missing expected GV100AD text file: ${downloadUrl}`)
    }
    const match = txtEntry.name.match(/GV100AD_(\d{8})\.txt/i)
    const snapshotRaw = match?.[1]
    if (!snapshotRaw) {
      throw new Error(`Could not parse snapshot date from entry: ${txtEntry.name}`)
    }
    const snapshotDate = parseDdMmYyyy(snapshotRaw)
    if (!snapshotDate) {
      throw new Error(`Invalid snapshot date in entry name: ${txtEntry.name}`)
    }
    const textFileBuffer = Buffer.from(await txtEntry.async('uint8array'))
    candidates.push({
      downloadUrl,
      archiveEntry: txtEntry.name,
      snapshotDate: snapshotDate.toISOString().slice(0, 10),
      textFileBuffer,
    })
  }
  if (candidates.length === 0) {
    throw new Error('No quarterly GV100AD sources available')
  }
  candidates.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
  const latest = candidates.at(-1)!
  logLine('selected latest quarterly source', {
    snapshotDate: latest.snapshotDate,
    archiveEntry: latest.archiveEntry,
    downloadUrl: latest.downloadUrl,
  })
  return latest
}

/** Build lookup maps from GV100AD fixed-width TXT (inside Destatis quarterly ZIP). */
function parseGv100AdTxtToLookup(buffer: Buffer): ParsedLookupTables {
  const rows = parseGv100AdTxtRows(buffer)

  const bundeslaender = new Map<string, string>()
  const regierungsbezirke = new Map<string, string>()
  const kreise = new Map<string, string>()
  const gemeindeverbaende = new Map<string, string>()
  const gemeindenByAgs = new Map<string, string>()
  const gemeindenByArs = new Map<string, string>()

  for (const row of rows) {
    if (!/^\d+$/.test(row.satzart.trim())) continue
    const land = normalizeDigits(row.land, 2)
    const rb = normalizeDigits(row.rb, 1)
    const kreis = normalizeDigits(row.kreis, 2)
    const vb = normalizeDigits(row.vb, 4)
    const name = row.name.trim()
    switch (row.satzart.trim()) {
      case '10':
        setLookupValue(bundeslaender, land, name, 'bundesland')
        break
      case '20':
        setLookupValue(regierungsbezirke, `${land}${rb}`, name, 'regierungsbezirk')
        break
      case '40':
        setLookupValue(kreise, `${land}${rb}${kreis}`, name, 'kreis')
        break
      case '50':
        setLookupValue(gemeindeverbaende, `${land}${rb}${kreis}${vb}`, name, 'gemeindeverband')
        break
      case '60': {
        setLookupValue(gemeindenByArs, makeArs12(row), name, 'gemeindeByArs')
        setLookupValue(gemeindenByAgs, makeAgs8(row), name, 'gemeindeByAgs')
        break
      }
      default:
        break
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    generatedAt: new Date().toISOString(),
    bundeslaender: sortedObject(bundeslaender),
    regierungsbezirke: sortedObject(regierungsbezirke),
    kreise: sortedObject(kreise),
    gemeindeverbaende: sortedObject(gemeindeverbaende),
    gemeindenByAgs: sortedObject(gemeindenByAgs),
    gemeindenByArs: sortedObject(gemeindenByArs),
  }
}

function writeGeneratedModule(outAbsPath: string, payload: GeneratedGermanKeyLookup): void {
  const body = JSON.stringify(payload, null, 2)
  const source = `/* AUTO-GENERATED by scripts/report/generate-german-key-lookup.ts. Do not edit manually. */
const germanKeyLookup = ${body} as const

export default germanKeyLookup
`
  mkdirSync(dirname(outAbsPath), { recursive: true })
  writeFileSync(outAbsPath, source, 'utf8')
}

function formatGeneratedModule(outAbsPath: string): void {
  const result = spawnSync('bun', ['x', 'oxfmt', '--write', outAbsPath], {
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`oxfmt failed for ${outAbsPath} (exit ${result.status ?? 'unknown'})`)
  }
}

async function main(): Promise<void> {
  const { weekly, force } = parseArgs(process.argv.slice(2))
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const outAbsPath = join(workspaceRoot, GENERATED_MODULE_RELATIVE_PATH)

  if (weekly && !force) {
    const checkedAt = await readExistingCheckedAt(outAbsPath)
    if (checkedAt) {
      const checkedWeek = isoWeekKey(new Date(checkedAt))
      const currentWeek = isoWeekKey(new Date())
      logLine('weekly freshness check', { checkedAt, checkedWeek, currentWeek })
      if (checkedWeek === currentWeek) {
        logLine('lookup already refreshed this ISO week; skipping')
        return
      }
    } else {
      logLine('no previous generated lookup found; refreshing now')
    }
  }

  const latestSource = await resolveLatestQuarterlySource()
  const tables = parseGv100AdTxtToLookup(latestSource.textFileBuffer)
  const payload: GeneratedGermanKeyLookup = {
    ...tables,
    source: {
      downloadUrl: latestSource.downloadUrl,
      archiveEntry: latestSource.archiveEntry,
      snapshotDate: latestSource.snapshotDate,
    },
  }

  writeGeneratedModule(outAbsPath, payload)
  formatGeneratedModule(outAbsPath)

  logLine('lookup generated', {
    output: GENERATED_MODULE_RELATIVE_PATH,
    bundeslaender: Object.keys(payload.bundeslaender).length,
    regierungsbezirke: Object.keys(payload.regierungsbezirke).length,
    kreise: Object.keys(payload.kreise).length,
    gemeindeverbaende: Object.keys(payload.gemeindeverbaende).length,
    gemeindenByAgs: Object.keys(payload.gemeindenByAgs).length,
  })
}

main().catch((error) => {
  console.error(`[german-key-lookup] failed: ${String(error)}`)
  process.exit(1)
})
