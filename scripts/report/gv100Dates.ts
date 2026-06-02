/** Shared GV100 / GVAuszug date parsing (DDMMYYYY filenames, sheet names, row fields). */

export function utcDateFromParts(year: number, month: number, day: number): Date | null {
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

/** Parse `DDMMYYYY` (Destatis TXT filenames and Excel row dates). */
export function parseDdMmYyyy(raw: string): Date | null {
  if (!/^\d{8}$/.test(raw)) return null
  const day = Number(raw.slice(0, 2))
  const month = Number(raw.slice(2, 4))
  const year = Number(raw.slice(4, 8))
  return utcDateFromParts(year, month, day)
}

/** Parse `DDMMYY` (older GV100ADJ `.ASC` filenames). */
export function parseDdMmYy(raw: string): Date | null {
  if (!/^\d{6}$/.test(raw)) return null
  const day = Number(raw.slice(0, 2))
  const month = Number(raw.slice(2, 4))
  const yy = Number(raw.slice(4, 6))
  const year = yy <= 50 ? 2000 + yy : 1900 + yy
  return utcDateFromParts(year, month, day)
}

export function snapshotIsoFromDdMmYyyy(raw: string): string | null {
  const date = parseDdMmYyyy(raw)
  return date ? date.toISOString().slice(0, 10) : null
}

/** Sheet suffix `DDMMYYYY` from `Onlineprodukt_Gemeinden30062026`. */
export function snapshotIsoFromGvAuszugSheetName(
  sheetName: string,
  pattern: RegExp,
): string | null {
  const match = pattern.exec(sheetName)
  if (!match?.[1]) return null
  return snapshotIsoFromDdMmYyyy(match[1])
}
