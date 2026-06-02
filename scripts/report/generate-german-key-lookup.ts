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
import type { Gv100AdRow } from './gv100AdRow.ts'
import { parseDdMmYy, parseDdMmYyyy } from './gv100Dates.ts'
import { formatValidationErrors, validateGvHierarchy } from './gv100HierarchyValidate.ts'
import { rowsToLookupMaps, type LookupDuplicateWarning } from './gv100LookupMaps.ts'
import { parseGv100AdTxtRows } from './parseGv100AdTxt.ts'
import { gvAuszugXlsxBasename, parseGvAuszugXlsx } from './parseGvAuszugXlsx.ts'

const OUTPUT_JSON_RELATIVE_PATH = 'report/public/data/german-key-lookup.json'

const LATEST_SOURCE = {
  id: 'latest' as const,
  label: 'Letzte Veröffentlichung (GVAuszugQ Quartalsausgaben, Excel)',
  provenanceLines: [] as const,
  sourcePublicUrl:
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/_inhalt.html#124272',
  downloadUrls: [
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV1QAktuell.xlsx?__blob=publicationFile&v=16',
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV2QAktuell.xlsx?__blob=publicationFile&v=13',
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV3QAktuell.xlsx?__blob=publicationFile&v=21',
    'https://www.destatis.de/DE/Themen/Laender-Regionen/Regionales/Gemeindeverzeichnis/Administrativ/Archiv/GVAuszugQ/AuszugGV4QAktuell.xlsx?__blob=publicationFile&v=18',
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

type ResolvedSource = {
  downloadUrl: string
  archiveEntry: string
  snapshotDate: string
  rows: Gv100AdRow[]
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

const DUPLICATE_LOOKUP_LOG_LIMIT = 10

function logLookupDuplicate(warning: LookupDuplicateWarning): void {
  logLine('duplicate lookup key (keeping first name)', {
    scope: warning.scope,
    key: warning.key,
    lineOrRow: warning.lineOrRow,
    kept: warning.previous,
    ignored: warning.incoming,
  })
}

function rowsToLookupMapsWithLoggedDuplicates(rows: Gv100AdRow[]): GermanKeyLookupMaps {
  let duplicateCount = 0
  const maps = rowsToLookupMaps(rows, (warning) => {
    duplicateCount += 1
    if (duplicateCount <= DUPLICATE_LOOKUP_LOG_LIMIT) {
      logLookupDuplicate(warning)
    }
  })
  if (duplicateCount > DUPLICATE_LOOKUP_LOG_LIMIT) {
    logLine('additional duplicate lookup keys suppressed', {
      suppressed: duplicateCount - DUPLICATE_LOOKUP_LOG_LIMIT,
    })
  }
  return maps
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

async function loadLatestExcelCandidate(downloadUrl: string): Promise<ResolvedSource> {
  const buffer = await downloadBuffer(downloadUrl)
  const xlsxBasename = gvAuszugXlsxBasename(downloadUrl)
  const parsed = await parseGvAuszugXlsx(buffer, xlsxBasename)
  return {
    downloadUrl,
    archiveEntry: parsed.archiveEntry,
    snapshotDate: parsed.snapshotDate,
    rows: parsed.rows,
  }
}

async function loadAnnualTxtCandidate(downloadUrl: string): Promise<ResolvedSource> {
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
  return {
    downloadUrl,
    archiveEntry: txtEntry.name,
    snapshotDate: snapshotIso,
    rows: parseGv100AdTxtRows(textFileBuffer),
  }
}

async function resolveBestValidSource(
  datasetId: string,
  downloadUrls: readonly string[],
  loadCandidate: (downloadUrl: string) => Promise<ResolvedSource>,
): Promise<ResolvedSource> {
  const valid: ResolvedSource[] = []

  for (const downloadUrl of downloadUrls) {
    const candidate = await loadCandidate(downloadUrl)
    const validation = validateGvHierarchy(candidate.rows)
    if (!validation.ok) {
      logLine('rejected source', {
        datasetId,
        snapshotDate: candidate.snapshotDate,
        archiveEntry: candidate.archiveEntry,
        errors: validation.errors.length,
        first: formatValidationErrors(validation.errors, 1),
      })
      continue
    }
    valid.push(candidate)
  }

  if (valid.length === 0) {
    throw new Error(
      `No valid GV100 sources for dataset ${datasetId}; all ${downloadUrls.length} candidate(s) failed structural validation`,
    )
  }

  valid.sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))
  const best = valid.at(-1)!
  logLine('selected publication source', {
    datasetId,
    snapshotDate: best.snapshotDate,
    archiveEntry: best.archiveEntry,
    downloadUrl: best.downloadUrl,
  })
  return best
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

function buildLatestPrefixGuards(latest: LookupMaps): {
  bundeslandPrefixes: Set<string>
  kreisPrefixes: Set<string>
} {
  const bundeslandPrefixes = new Set<string>()
  const kreisPrefixes = new Set<string>()
  for (const ags of Object.keys(latest.gemeindenByAgs)) {
    if (ags.length >= 2) bundeslandPrefixes.add(ags.slice(0, 2))
    if (ags.length >= 5) kreisPrefixes.add(ags.slice(0, 5))
  }
  return { bundeslandPrefixes, kreisPrefixes }
}

function shouldSkipObsoleteKey(
  mapName: (typeof MAP_KEYS)[number],
  key: string,
  guards: ReturnType<typeof buildLatestPrefixGuards>,
): boolean {
  if (mapName === 'bundeslaender') return guards.bundeslandPrefixes.has(key)
  if (mapName === 'kreise') return guards.kreisPrefixes.has(key)
  return false
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
  const guards = buildLatestPrefixGuards(latest)

  for (const mk of MAP_KEYS) {
    const L = latest[mk]
    const A = annualMaps[mk]
    const O = obsoleteMaps[mk]
    const Y = lastContainedInYear[mk]
    for (const [key, name] of Object.entries(A)) {
      if (Object.hasOwn(L, key)) continue
      if (shouldSkipObsoleteKey(mk, key, guards)) continue
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

  const latestResolved = await resolveBestValidSource(
    'latest',
    LATEST_SOURCE.downloadUrls,
    loadLatestExcelCandidate,
  )
  const latestMaps = rowsToLookupMapsWithLoggedDuplicates(latestResolved.rows)

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
    const resolved = await resolveBestValidSource(
      `gv100adj-${def.year}`,
      def.downloadUrls,
      loadAnnualTxtCandidate,
    )
    const annualMaps = rowsToLookupMapsWithLoggedDuplicates(resolved.rows)
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
