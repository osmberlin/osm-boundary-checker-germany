import type { CSSProperties, ReactNode } from 'react'
import { de } from '../i18n/de'
import type { ReportRow } from '../types/report'
import { mapLayerColors } from './mapLayerColors'
import { hexToRgba } from './MapLegend'

const o = mapLayerColors.officialMatched
const osmPaired = mapLayerColors.osmPaired
const osmUnmatched = mapLayerColors.osmUnmatched
const officialOnly = mapLayerColors.officialOnly

/** Softer than solid `osmPaired.line` for UI double-stroke (map line stays full opacity). */
const OSM_PAIRED_LINE_BORDER_UI = hexToRgba(osmPaired.line, 0.7)

const swatchBox = 'h-5 w-10 shrink-0 rounded-sm border-2 border-solid'

const pillBase =
  'inline-flex max-w-full items-center rounded-md border-2 border-solid px-2 py-0.5 text-sm font-medium leading-snug tracking-tight'

/**
 * Category legend swatches — same fills, strokes and split as comparison map layer toggles.
 */
export function reportCategorySwatchStyle(category: ReportRow['category']): {
  className: string
  style: CSSProperties
} {
  switch (category) {
    case 'unmatched_osm':
      return {
        className: swatchBox,
        style: {
          borderColor: osmUnmatched.line,
          backgroundColor: hexToRgba(osmUnmatched.fill, osmUnmatched.fillOpacity),
        },
      }
    case 'official_only':
      return {
        className: swatchBox,
        style: {
          borderColor: officialOnly.line,
          backgroundColor: hexToRgba(officialOnly.fill, officialOnly.fillOpacity),
        },
      }
    case 'matched':
      return {
        className: swatchBox,
        style: {
          borderColor: o.line,
          backgroundColor: hexToRgba(osmPaired.fill, osmPaired.fillOpacity),
          boxShadow: `inset 0 0 0 2px ${OSM_PAIRED_LINE_BORDER_UI}`,
        },
      }
  }
}

/**
 * Inline category label (table, dialogs, home) — matched uses single yellow OSM
 * stroke + translucent fill (same as map OSM-paired layer cue, no amtlich ring on the pill).
 */
export function reportCategoryPillStyle(category: ReportRow['category']): {
  className: string
  style: CSSProperties
} {
  switch (category) {
    case 'unmatched_osm':
      return unmatchedOsmStatPillStyle()
    case 'official_only':
      return {
        className: pillBase,
        style: {
          borderColor: officialOnly.line,
          backgroundColor: hexToRgba(officialOnly.fill, officialOnly.fillOpacity),
          color: 'rgb(224 242 254)',
        },
      }
    case 'matched':
      return {
        className: pillBase,
        style: {
          borderColor: OSM_PAIRED_LINE_BORDER_UI,
          backgroundColor: hexToRgba(osmPaired.fill, osmPaired.fillOpacity),
          color: 'rgb(248 250 252)',
        },
      }
  }
}

/** Unmatched-OSM stat styling: geometries use OSM overlay colors on the map. */
export function unmatchedOsmStatPillStyle(): { className: string; style: CSSProperties } {
  return {
    className: pillBase,
    style: {
      borderColor: osmUnmatched.line,
      backgroundColor: hexToRgba(osmUnmatched.fill, osmUnmatched.fillOpacity),
      color: 'rgb(255 237 213)',
    },
  }
}

export function ReportCategorySwatch({ category }: { category: ReportRow['category'] }) {
  const s = reportCategorySwatchStyle(category)
  return <div className={s.className} style={s.style} aria-hidden />
}

const legendRectClass = 'inline-block h-[18px] w-[18px] rounded-[2px] border-2 border-solid'

function LegendRect({
  borderColor,
  backgroundColor = 'transparent',
  title,
}: {
  borderColor: string
  backgroundColor?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={legendRectClass}
      style={{ borderColor, backgroundColor }}
    />
  )
}

export type LegendRectItem = {
  borderColor: string
  backgroundColor?: string
}

export function LegendRectSwatch({ items }: { items: LegendRectItem[] }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {items.map((item, idx) => (
        <LegendRect key={`${item.borderColor}-${idx}`} {...item} />
      ))}
    </span>
  )
}

export function ReportCategorySquareSwatch({ category }: { category: ReportRow['category'] }) {
  if (category === 'matched') {
    const layerLabels = de.feature.stats
    return (
      <span className="inline-flex items-center gap-1" aria-hidden>
        <LegendRect borderColor={o.line} title={layerLabels.areaOfficial} />
        <LegendRect
          borderColor={OSM_PAIRED_LINE_BORDER_UI}
          backgroundColor={hexToRgba(osmPaired.fill, osmPaired.fillOpacity)}
          title={layerLabels.areaOsm}
        />
      </span>
    )
  }

  const single =
    category === 'official_only'
      ? { line: officialOnly.line, fill: officialOnly.fill, fillOpacity: officialOnly.fillOpacity }
      : { line: osmUnmatched.line, fill: osmUnmatched.fill, fillOpacity: osmUnmatched.fillOpacity }

  return (
    <LegendRectSwatch
      items={[
        {
          borderColor: single.line,
          backgroundColor: hexToRgba(single.fill, single.fillOpacity),
        },
      ]}
    />
  )
}

export function ReportCategoryPill({
  category,
  children,
  className = '',
}: {
  category: ReportRow['category']
  children: ReactNode
  className?: string
}) {
  const p = reportCategoryPillStyle(category)
  return (
    <span className={[p.className, className].filter(Boolean).join(' ')} style={p.style}>
      {children}
    </span>
  )
}

export function UnmatchedOsmStatPill({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const p = unmatchedOsmStatPillStyle()
  return (
    <span className={[p.className, className].filter(Boolean).join(' ')} style={p.style}>
      {children}
    </span>
  )
}
