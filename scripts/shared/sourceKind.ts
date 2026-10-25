import { z } from 'zod'

/**
 * How the report words the "official" side of a dataset (see `report/src/i18n/sourceVocabulary.tsx`).
 * `official`: authority data ("amtlich"). `dtp`: Digitize the Planet e.V. (geometries come from authorities via DtP).
 * Derived from the dataset config (`sourceKindFromDatasetConfig`); absent in payloads means `official`.
 */
export const sourceKindSchema = z.enum(['official', 'dtp'])
export type SourceKind = z.infer<typeof sourceKindSchema>
