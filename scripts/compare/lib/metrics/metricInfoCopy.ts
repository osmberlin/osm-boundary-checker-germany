/** German (or other locale) copy for the metric info modal — colocated with each metric’s `de.ts`. */
export type MetricInfoCopy = {
  triggerAria: string
  title: string
  lead: string
  paragraphs: readonly string[]
  references?: readonly {
    label: string
    href: string
  }[]
  close: string
}
