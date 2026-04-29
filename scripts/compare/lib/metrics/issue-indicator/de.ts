import type { MetricInfoCopy } from '../metricInfoCopy.ts'

export const issueIndicatorModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zur Bewertungsampel anzeigen',
  title: 'Was bedeutet die Bewertungsampel?',
  lead: 'Die Ampel stuft Abweichungen als ok, review oder issue ein. Sie ist bewusst skalensensitiv und bewertet nicht nur den maximalen Hausdorff-Wert.',
  paragraphs: [
    'Die Entscheidung kombiniert mehrere Kennzahlen: IoU, symmetrische Differenz, Flächenabweichung sowie robuste Randdistanz (Hausdorff P95) und eine skalierte Distanznorm. Dadurch wird vermieden, dass große Regionen allein wegen einer hohen absoluten Distanz als Problem markiert werden.',
    'Ein hoher Maximal-Hausdorff kann bei großen Flächen auftreten, obwohl sich die Geometrien praktisch fast vollständig überlappen. In solchen Fällen kann die Ampel weiterhin "ok" sein.',
    'Zusätzlich wird ein robuster Basislinien-Check genutzt: Wenn sich ein Objekt gegenüber dem letzten Lauf ungewöhnlich stark verändert (MAD / modified z-score), wird es mindestens als "review" markiert.',
  ],
  references: [
    {
      label: 'Hausdorff Distance Image Comparison (Cornell)',
      href: 'https://www.cs.cornell.edu/~dph/hausdorff/hausdorff.html',
    },
    {
      label: 'Boundary IoU (CVPR 2021)',
      href: 'https://arxiv.org/abs/2103.16562',
    },
    {
      label: 'Robust Hausdorff percentile (surface-distance docs)',
      href: 'https://segmentationmetrics.readthedocs.io/en/latest/segmentationmetrics.surface_distance.html',
    },
    {
      label: 'NIST: Detection of Outliers (MAD / modified z-score)',
      href: 'https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm',
    },
  ],
  close: 'Schließen',
}
