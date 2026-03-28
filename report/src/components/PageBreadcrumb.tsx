import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { de } from '../i18n/de'
import { AppBreadcrumb, type AppBreadcrumbCrumb } from './AppBreadcrumb'

function shortFeatureKey(encoded: string) {
  const d = decodeURIComponent(encoded)
  return d.length > 40 ? `${d.slice(0, 37)}…` : d
}

/** Route-derived crumbs in the global header (replaces a separate title bar). */
export function PageBreadcrumb() {
  const { pathname } = useLocation()

  const crumbs: { homeCurrent: boolean; items: AppBreadcrumbCrumb[] } = useMemo(() => {
    const segs = pathname.split('/').filter(Boolean)
    if (segs.length === 0) {
      return { homeCurrent: true, items: [] }
    }

    if (segs[0] === 'status') {
      return {
        homeCurrent: false,
        items: [{ name: de.status.breadcrumb, current: true }],
      }
    }

    const areaId = segs[0]
    if (!areaId) {
      return { homeCurrent: true, items: [] }
    }

    if (segs.length === 1) {
      return { homeCurrent: false, items: [{ name: areaId, current: true }] }
    }

    if (segs[1] === 'unmatched') {
      return {
        homeCurrent: false,
        items: [
          { name: areaId, to: `/${areaId}` },
          { name: de.unmatched.breadcrumbLabel, current: true },
        ],
      }
    }

    if (segs[1] === 'feature' && segs[2]) {
      const fk = segs[2]
      return {
        homeCurrent: false,
        items: [
          { name: areaId, to: `/${areaId}` },
          { name: shortFeatureKey(fk), current: true },
        ],
      }
    }

    return { homeCurrent: false, items: [{ name: areaId, current: true }] }
  }, [pathname])

  return (
    <AppBreadcrumb appTitle={de.appTitle} homeCurrent={crumbs.homeCurrent} items={crumbs.items} />
  )
}
