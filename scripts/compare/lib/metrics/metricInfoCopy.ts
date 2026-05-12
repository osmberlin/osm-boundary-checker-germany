/** Section headings for metric info dialogs (German UI). */
export const metricInfoModalSectionsDe = {
  howToRead: 'So lesen Sie den Wert',
  technical: 'Technik und Berechnung',
  references: 'Quellen und weiterführende Links',
  bandsTable: 'Einordnung',
  bandsTwoTier: 'Einordnung',
} as const

/** German (or other locale) copy for the metric info modal — colocated with each metric’s `de.ts`. */
export type MetricInfoCopy = {
  triggerAria: string
  title: string
  lead: string
  /** Optional bullets shown under `lead` (e.g. scale endpoints). */
  leadBullets?: readonly string[]
  howToRead: readonly string[]
  /**
   * When set, replaces the default „So lesen Sie den Wert“ heading for the how-to-read block.
   */
  howToReadHeading?: string
  /** When set, „So lesen Sie …“ renders as a bullet list instead of separate paragraphs. */
  howToReadAsList?: boolean
  technical: readonly string[]
  references?: readonly {
    label: string
    href: string
    /** Plain text after the link (not part of the anchor). */
    note?: string
  }[]
  close: string
  /**
   * When true and `bandContext.metricsCrs` is set, the report appends CRS info
   * after the technical block (label line vs. integrated sentence).
   */
  appendMetricsCrsNote?: boolean
  /** How to append CRS when {@link appendMetricsCrsNote} is true. Default: label line. */
  metricsCrsNoteStyle?: 'appendLabel' | 'appendSentence'
  /** When true, technical body renders without the section h3. */
  hideTechnicalHeading?: boolean
}
