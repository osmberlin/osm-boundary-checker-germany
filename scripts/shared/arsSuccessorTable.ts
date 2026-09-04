import { z } from 'zod'

export const ARS_SUCCESSOR_KINDS = ['kreisfrei'] as const
export type ArsSuccessorKind = (typeof ARS_SUCCESSOR_KINDS)[number]

const ars12Schema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ''))
  .pipe(z.string().regex(/^\d{12}$/, 'expected 12-digit ARS'))

const validFromSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

export const arsSuccessorRowSchema = z
  .object({
    fromArs: ars12Schema,
    toArs: ars12Schema,
    validFrom: validFromSchema,
    kind: z.enum(ARS_SUCCESSOR_KINDS),
    note: z.string().trim().min(1),
    issueUrl: z.url().optional(),
  })
  .strict()
  .refine((row) => row.fromArs !== row.toArs, {
    message: 'fromArs and toArs must differ',
    path: ['toArs'],
  })

export const arsSuccessorTableSchema = z
  .object({
    successors: z.array(arsSuccessorRowSchema),
  })
  .strict()
  .superRefine((table, ctx) => {
    const fromSeen = new Set<string>()
    const toSeen = new Set<string>()
    for (const [index, row] of table.successors.entries()) {
      if (fromSeen.has(row.fromArs)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate fromArs ${row.fromArs}`,
          path: ['successors', index, 'fromArs'],
        })
      }
      fromSeen.add(row.fromArs)
      if (toSeen.has(row.toArs)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate toArs ${row.toArs}`,
          path: ['successors', index, 'toArs'],
        })
      }
      toSeen.add(row.toArs)
    }
  })

export type ArsSuccessorRow = z.infer<typeof arsSuccessorRowSchema>
export type ArsSuccessorTable = z.infer<typeof arsSuccessorTableSchema>

/** AGS = LLRKK + GGG (skip the four Gemeindeverband digits). */
export function ags8FromArs12(ars12: string) {
  const d = ars12.replace(/\D/g, '')
  if (d.length !== 12) return null
  return `${d.slice(0, 5)}${d.slice(9, 12)}`
}

export function parseArsSuccessorTable(raw: unknown) {
  return arsSuccessorTableSchema.parse(raw)
}

export function lookupSuccessorByFromArs(table: ArsSuccessorTable, ars12: string) {
  const d = ars12.replace(/\D/g, '')
  return table.successors.find((row) => row.fromArs === d)
}

export function lookupSuccessorByToArs(table: ArsSuccessorTable, ars12: string) {
  const d = ars12.replace(/\D/g, '')
  return table.successors.find((row) => row.toArs === d)
}

/**
 * Explorer lookup: exact 12-digit ARS, or an 8-digit AGS that belongs to exactly one row.
 */
export function lookupSuccessorForExplorerKey(table: ArsSuccessorTable, rawKey: string) {
  const d = rawKey.replace(/\D/g, '')
  if (d.length === 12) {
    const from = lookupSuccessorByFromArs(table, d)
    if (from) return { row: from, side: 'from' }
    const to = lookupSuccessorByToArs(table, d)
    if (to) return { row: to, side: 'to' }
    return null
  }
  if (d.length !== 8) return null
  const hits: Array<{ row: ArsSuccessorRow; side: 'from' | 'to' }> = []
  for (const row of table.successors) {
    if (ags8FromArs12(row.fromArs) === d) hits.push({ row, side: 'from' })
    if (ags8FromArs12(row.toArs) === d) hits.push({ row, side: 'to' })
  }
  return hits.length === 1 ? hits[0]! : null
}
