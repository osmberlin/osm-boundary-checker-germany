import type { CSSProperties, ReactNode } from 'react'
import type { ReportRow } from '../types/report'
import { hexToRgba } from './MapLegend'
import { mapLayerColors } from './mapLayerColors'

const o = mapLayerColors.official
const osm = mapLayerColors.osm

const swatchBox = 'h-5 w-10 shrink-0 rounded-sm border-2 border-solid'

const pillBase =
  'inline-flex max-w-full items-center rounded-md border-2 border-solid px-2 py-0.5 text-sm font-medium leading-snug tracking-tight'

/**
 * Category legend swatches — same fills, strokes and split as ComparisonVectorLayers / StatsStrip layer toggles.
 */
export function reportCategorySwatchStyle(category: ReportRow['category']): {
  className: string
  style: CSSProperties
} {
  if (category === 'official_only') {
    return {
      className: swatchBox,
      style: {
        borderColor: o.line,
        backgroundColor: hexToRgba(o.fill, o.fillOpacity),
      },
    }
  }
  return {
    className: `${swatchBox} border-slate-500`,
    style: {
      background: `linear-gradient(90deg, ${hexToRgba(o.fill, o.fillOpacity)} 50%, ${hexToRgba(osm.fill, osm.fillOpacity)} 50%)`,
    },
  }
}

/**
 * Inline category label (feature header, table) — same palette as map overlays.
 */
export function reportCategoryPillStyle(category: ReportRow['category']): {
  className: string
  style: CSSProperties
} {
  if (category === 'official_only') {
    return {
      className: pillBase,
      style: {
        borderColor: o.line,
        backgroundColor: hexToRgba(o.fill, o.fillOpacity),
        color: 'rgb(224 242 254)',
      },
    }
  }
  return {
    className: `${pillBase} border-slate-500`,
    style: {
      background: `linear-gradient(90deg, ${hexToRgba(o.fill, o.fillOpacity)} 50%, ${hexToRgba(osm.fill, osm.fillOpacity)} 50%)`,
      color: 'rgb(248 250 252)',
    },
  }
}

/** Unmatched-OSM list stat: geometries use OSM overlay styling on the map (see UnmatchedReport). */
export function unmatchedOsmStatPillStyle(): { className: string; style: CSSProperties } {
  return {
    className: pillBase,
    style: {
      borderColor: osm.line,
      backgroundColor: hexToRgba(osm.fill, osm.fillOpacity),
      color: 'rgb(255 237 213)',
    },
  }
}

export function ReportCategorySwatch({ category }: { category: ReportRow['category'] }) {
  const s = reportCategorySwatchStyle(category)
  return <div className={s.className} style={s.style} aria-hidden />
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
