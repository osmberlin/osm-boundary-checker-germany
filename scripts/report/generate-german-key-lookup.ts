#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import JSZip from 'jszip'
import {
  germanKeyLookupBundleSchema,
  type GermanKeyLatestDataset,
  type GermanKeyLookupBundle,
  type GermanKeyLookupMaps,
  type GermanKeyObsoleteSection,
} from '../shared/germanKeyLookupPayload.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

const OUTPUT_JSON_RELATIVE_PATH = 'report/public/data/german-key-lookup.json'

const LATEST_SOURCE = {
  id: 'latest' as const,
  label: 'Letzte Veröffentlichung (GV100AD Quartalsausgaben)',
  provenanceLines: [] as const,
  sourcePublicUrl:
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/_inhalt.html#124272',
  downloadUrls: [
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADQ/GV100AD1QAktuell.zip?__blob=publicationFile&v=17',
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADQ/GV100AD2QAktuell.zip?__blob=publicationFile&v=14',
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADQ/GV100AD3QAktuell.zip?__blob=publicationFile&v=16',
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADQ/GV100AD4QAktuell.zip?__blob=publicationFile&v=15',
  ],
} as const

/** GV100ADJ Jahresausgaben 31.12.YYYY — processed oldest→newest so `lastContainedInYear` stays maximal. */
const ANNUAL_GV100ADJ_SOURCES = [
  {
    year: 2018,
    label: 'GV100ADJ Jahresausgabe 31.12.2018',
    provenanceLines: ['Jahresausgabe am 31.12.2018'] as const,
    sourcePublicUrl:
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122018.html',
    downloadUrls: [
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122018.zip?__blob=publicationFile&v=3',
    ],
  },
  {
    year: 2019,
    label: 'GV100ADJ Jahresausgabe 31.12.2019',
    provenanceLines: ['Jahresausgabe am 31.12.2019'] as const,
    sourcePublicUrl:
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122019.html',
    downloadUrls: [
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122019.zip?__blob=publicationFile&v=4',
    ],
  },
  {
    year: 2020,
    label: 'GV100ADJ Jahresausgabe 31.12.2020',
    provenanceLines: ['Jahresausgabe am 31.12.2020'] as const,
    sourcePublicUrl:
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122020.html',
    downloadUrls: [
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122020.zip?__blob=publicationFile&v=2',
    ],
  },
  {
    year: 2021,
    label: 'GV100ADJ Jahresausgabe 31.12.2021',
    provenanceLines: ['Jahresausgabe am 31.12.2021'] as const,
    sourcePublicUrl:
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122021.html',
    downloadUrls: [
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122021.zip?__blob=publicationFile&v=1',
    ],
  },
  {
    year: 2022,
    label: 'GV100ADJ Jahresausgabe 31.12.2022',
    provenanceLines: ['Jahresausgabe am 31.12.2022'] as const,
    sourcePublicUrl:
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122022.html',
    downloadUrls: [
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122022.zip?__blob=publicationFile&v=1',
    ],
  },
  {
    year: 2023,
    label: 'GV100ADJ Jahresausgabe 31.12.2023',
    provenanceLines: ['Jahresausgabe am 31.12.2023'] as const,
    sourcePublicUrl:
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122023.html',
    downloadUrls: [
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122023.zip?__blob=publicationFile&v=2',
    ],
  },
  {
    year: 2024,
    label: 'GV100ADJ Jahresausgabe 31.12.2024',
    provenanceLines: [
      'Jahresausgabe am 31.12.2024',
      'Veröffentlichung passend zu den BKG-Verwaltungsgebieten (Stand 31.12.2025)',
    ] as const,
    sourcePublicUrl:
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122024.html',
    downloadUrls: [
      'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GV100ADJ/GV100AD31122024.zip?__blob=publicationFile&v=2',
    ],
  },
] as const

const MAP_KEYS = [
  'bundeslaender',
  'regierungsbezirke',
  'kreise',
  'gemeindeverbaende',
  'gemeindenByAgs',
  'gemeindenByArs',
] as const satisfies readonly (keyof GermanKeyLookupMaps)[]

type PublicationSource = {
  downloadUrl: string
  archiveEntry: string
  snapshotDate: string
}

type MunicipalityWorkbookRow = {
  satzart: string
  snapshotDateRaw: string
  land: string
  rb: string
  kreis: string
  vb: string
  gem: string
  name: string
}

type SourceCandidate = PublicationSource & {
  textFileBuffer: Buffer
}

type LookupMaps = GermanKeyLookupMaps

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

function readExistingCheckedAt(jsonAbsPath: string): string | undefined {
  if (!existsSync(jsonAbsPath)) return undefined
  try {
    const raw = JSON.parse(readFileSync(jsonAbsPath, 'utf8')) as unknown
    const parsed = germanKeyLookupBundleSchema.safeParse(raw)
    return parsed.success ? parsed.data.checkedAt : undefined
  } catch (error) {
    logLine('existing JSON unreadable, forcing refresh', { detail: String(error) })
    return undefined
  }
}

function normalizeDigits(value: string, length: number): string {
  const digits = value.replace(/\D/g, '')
  if (digits === '') return ''.padStart(length, '0')
  return digits.padStart(length, '0').slice(-length)
}

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

/** Older GV100ADJ archives use `GV100AD_DDMMYY.ASC` filenames (two-digit year). */
function parseDdMmYy(raw: string): Date | null {
  if (!/^\d{6}$/.test(raw)) return null
  const day = Number(raw.slice(0, 2))
  const month = Number(raw.slice(2, 4))
  const yy = Number(raw.slice(4, 6))
  const year = yy <= 50 ? 2000 + yy : 1900 + yy
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

function gv100AdEntryBasename(entryName: string): string {
  const parts = entryName.split(/[/\\]/)
  return parts[parts.length - 1] ?? entryName
}

function snapshotIsoFromGv100AdFilename(base: string): string | null {
  const mTxt8 = /^GV100AD_(\d{8})\.txt$/i.exec(base)
  if (mTxt8?.[1]) {
    const date = parseDdMmYyyy(mTxt8[1])
    return date ? date.toISOString().slice(0, 10) : null
  }
  const mTxt6 = /^GV100AD_(\d{6})\.txt$/i.exec(base)
  if (mTxt6?.[1]) {
    const date = parseDdMmYy(mTxt6[1])
    return date ? date.toISOString().slice(0, 10) : null
  }
  const mAsc = /^GV100AD_(\d{6})\.(?:ASC|asc)$/i.exec(base)
  if (mAsc?.[1]) {
    const date = parseDdMmYy(mAsc[1])
    return date ? date.toISOString().slice(0, 10) : null
  }
  return null
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
    gem: line.slice(15, 18),
    vb: line.slice(18, 22),
    name: line.slice(22, 72),
  }))
}

async function resolveBestPublicationSource(
  datasetId: string,
  downloadUrls: readonly string[],
): Promise<SourceCandidate> {
  const candidates: SourceCandidate[] = []
  for (const downloadUrl of downloadUrls) {
    const zipBuffer = await downloadBuffer(downloadUrl)
    const archive = await JSZip.loadAsync(zipBuffer)
    const txtEntry = Object.values(archive.files).find((entry) => {
      if (entry.dir) return false
      const base = gv100AdEntryBasename(entry.name)
      return (
        /^GV100AD_\d{8}\.txt$/i.test(base) ||
        /^GV100AD_\d{6}\.txt$/i.test(base) ||
        /^GV100AD_\d{6}\.(?:ASC|asc)$/i.test(base)
      )
    })
    if (!txtEntry) {
      throw new Error(`ZIP missing expected GV100AD .txt or .ASC file: ${downloadUrl}`)
    }
    const snapshotIso = snapshotIsoFromGv100AdFilename(gv100AdEntryBasename(txtEntry.name))
    if (!snapshotIso) {
      throw new Error(`Could not parse snapshot date from entry: ${txtEntry.name}`)
    }
    const textFileBuffer = Buffer.from(await txtEntry.async('uint8array'))
    candidates.push({
      downloadUrl,
      archiveEntry: txtEntry.name,
      snapshotDate: snapshotIso,
      textFileBuffer,
    })
  }
  if (candidates.length === 0) {
    throw new Error(`No GV100AD sources available for dataset ${datasetId}`)
  }
  candidates.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
  const best = candidates.at(-1)!
  logLine('selected publication source', {
    datasetId,
    snapshotDate: best.snapshotDate,
    archiveEntry: best.archiveEntry,
    downloadUrl: best.downloadUrl,
  })
  return best
}

function parseGv100AdTxtToLookupMaps(buffer: Buffer): LookupMaps {
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
    bundeslaender: sortedObject(bundeslaender),
    regierungsbezirke: sortedObject(regierungsbezirke),
    kreise: sortedObject(kreise),
    gemeindeverbaende: sortedObject(gemeindeverbaende),
    gemeindenByAgs: sortedObject(gemeindenByAgs),
    gemeindenByArs: sortedObject(gemeindenByArs),
  }
}

function emptyLookupMaps(): LookupMaps {
  return {
    bundeslaender: {},
    regierungsbezirke: {},
    kreise: {},
    gemeindeverbaende: {},
    gemeindenByAgs: {},
    gemeindenByArs: {},
  }
}

function emptyLastYearMaps(): GermanKeyObsoleteSection['lastContainedInYear'] {
  return {
    bundeslaender: {},
    regierungsbezirke: {},
    kreise: {},
    gemeindeverbaende: {},
    gemeindenByAgs: {},
    gemeindenByArs: {},
  }
}

/**
 * Accumulate obsolete rows: keys that appear in an annual GV100ADJ extract but not in `latest`.
 * Years are applied ascending; `lastContainedInYear` keeps the maximum year per key.
 */
function mergeAnnualObsoleteInto(
  latest: LookupMaps,
  annualMaps: LookupMaps,
  year: number,
  obsoleteMaps: LookupMaps,
  lastContainedInYear: GermanKeyObsoleteSection['lastContainedInYear'],
): void {
  for (const mk of MAP_KEYS) {
    const L = latest[mk]
    const A = annualMaps[mk]
    const O = obsoleteMaps[mk]
    const Y = lastContainedInYear[mk]
    for (const [key, name] of Object.entries(A)) {
      if (Object.hasOwn(L, key)) continue
      O[key] = name
      const prev = Y[key]
      Y[key] = prev === undefined ? year : Math.max(prev, year)
    }
  }
}

async function main(): Promise<void> {
  const { weekly, force } = parseArgs(process.argv.slice(2))
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const outAbsPath = join(workspaceRoot, OUTPUT_JSON_RELATIVE_PATH)

  if (weekly && !force) {
    const checkedAt = readExistingCheckedAt(outAbsPath)
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

  const now = new Date().toISOString()

  const latestResolved = await resolveBestPublicationSource('latest', LATEST_SOURCE.downloadUrls)
  const latestMaps = parseGv100AdTxtToLookupMaps(latestResolved.textFileBuffer)

  const latestDataset: GermanKeyLatestDataset = {
    id: 'latest',
    label: LATEST_SOURCE.label,
    provenanceLines: [...LATEST_SOURCE.provenanceLines],
    sourcePublicUrl: LATEST_SOURCE.sourcePublicUrl,
    source: {
      downloadUrl: latestResolved.downloadUrl,
      archiveEntry: latestResolved.archiveEntry,
      snapshotDate: latestResolved.snapshotDate,
    },
    ...latestMaps,
  }

  const obsoleteMaps = emptyLookupMaps()
  const lastContainedInYear = emptyLastYearMaps()

  const annualSourcePublicUrlsByYear: Record<string, string> = {}
  for (const def of ANNUAL_GV100ADJ_SOURCES) {
    annualSourcePublicUrlsByYear[String(def.year)] = def.sourcePublicUrl
  }

  for (const def of ANNUAL_GV100ADJ_SOURCES) {
    const resolved = await resolveBestPublicationSource(`gv100adj-${def.year}`, def.downloadUrls)
    const annualMaps = parseGv100AdTxtToLookupMaps(resolved.textFileBuffer)
    mergeAnnualObsoleteInto(latestMaps, annualMaps, def.year, obsoleteMaps, lastContainedInYear)
    logLine('annual obsolete merged', {
      year: def.year,
      snapshotDate: resolved.snapshotDate,
    })
  }

  const payload: GermanKeyLookupBundle = {
    checkedAt: now,
    generatedAt: now,
    latest: latestDataset,
    annualSourcePublicUrlsByYear,
    obsolete: {
      maps: obsoleteMaps,
      lastContainedInYear,
    },
  }

  function sortRecord(rec: Record<string, string>): Record<string, string> {
    return Object.fromEntries(
      Object.entries(rec).sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true })),
    )
  }

  function sortYearRecord(rec: Record<string, number>): Record<string, number> {
    return Object.fromEntries(
      Object.entries(rec).sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true })),
    )
  }

  const sortedObsoleteMaps: LookupMaps = {
    bundeslaender: sortRecord(obsoleteMaps.bundeslaender),
    regierungsbezirke: sortRecord(obsoleteMaps.regierungsbezirke),
    kreise: sortRecord(obsoleteMaps.kreise),
    gemeindeverbaende: sortRecord(obsoleteMaps.gemeindeverbaende),
    gemeindenByAgs: sortRecord(obsoleteMaps.gemeindenByAgs),
    gemeindenByArs: sortRecord(obsoleteMaps.gemeindenByArs),
  }

  const sortedLastYear: GermanKeyObsoleteSection['lastContainedInYear'] = {
    bundeslaender: sortYearRecord(lastContainedInYear.bundeslaender),
    regierungsbezirke: sortYearRecord(lastContainedInYear.regierungsbezirke),
    kreise: sortYearRecord(lastContainedInYear.kreise),
    gemeindeverbaende: sortYearRecord(lastContainedInYear.gemeindeverbaende),
    gemeindenByAgs: sortYearRecord(lastContainedInYear.gemeindenByAgs),
    gemeindenByArs: sortYearRecord(lastContainedInYear.gemeindenByArs),
  }

  const payloadSorted: GermanKeyLookupBundle = {
    ...payload,
    obsolete: {
      maps: sortedObsoleteMaps,
      lastContainedInYear: sortedLastYear,
    },
  }

  const validated = germanKeyLookupBundleSchema.parse(payloadSorted)

  mkdirSync(dirname(outAbsPath), { recursive: true })
  writeFileSync(outAbsPath, `${JSON.stringify(validated)}\n`, 'utf8')

  logLine('bundle written', {
    output: OUTPUT_JSON_RELATIVE_PATH,
    bundeslaender: Object.keys(validated.latest.bundeslaender).length,
    gemeindenByAgs: Object.keys(validated.latest.gemeindenByAgs).length,
    obsoleteGemeindenByAgs: Object.keys(validated.obsolete.maps.gemeindenByAgs).length,
    obsoleteGemeindenByArs: Object.keys(validated.obsolete.maps.gemeindenByArs).length,
  })
}

main().catch((error) => {
  console.error(`[german-key-lookup] failed: ${String(error)}`)
  process.exit(1)
})
