import { useRouterState } from '@tanstack/react-router'
import { de } from '../i18n/de'
import { areaDisplayNameForId } from '../lib/reportLookups'
import { safeDecodeURIComponent } from '../lib/safeDecodeURIComponent'
import { AppBreadcrumb, type AppBreadcrumbCrumb } from './AppBreadcrumb'

function shortFeatureKey(encoded: string) {
  const d = safeDecodeURIComponent(encoded)
  return d.length > 40 ? `${d.slice(0, 37)}…` : d
}

/** Route-derived crumbs in the global header (replaces a separate title bar). */
export function PageBreadcrumb() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const segs = pathname.split('/').filter(Boolean)
  const crumbs: { homeCurrent: boolean; items: AppBreadcrumbCrumb[] } =
    segs.length === 0
      ? { homeCurrent: true, items: [] }
      : segs[0] === 'status'
        ? {
            homeCurrent: false,
            items: [{ name: de.status.breadcrumb, current: true }],
          }
        : segs[0] === 'tools' && segs[1] === 'german-key'
          ? {
              homeCurrent: false,
              items: [{ name: de.germanKeyExplorer.title, current: true }],
            }
          : segs[0] === 'review'
            ? {
                homeCurrent: false,
                items: [{ name: de.review.breadcrumb, current: true }],
              }
            : (() => {
                const areaId = segs[0]
                if (!areaId) return { homeCurrent: true, items: [] }
                const areaLabel = areaDisplayNameForId(areaId)

                if (segs.length === 1) {
                  return { homeCurrent: false, items: [{ name: areaLabel, current: true }] }
                }

                if (segs[1] === 'feature' && segs[2]) {
                  const fk = segs[2]
                  return {
                    homeCurrent: false,
                    items: [
                      { name: areaLabel, to: `/${areaId}` },
                      { name: shortFeatureKey(fk), current: true },
                    ],
                  }
                }

                return { homeCurrent: false, items: [{ name: areaLabel, current: true }] }
              })()

  return (
    <AppBreadcrumb appTitle={de.appTitle} homeCurrent={crumbs.homeCurrent} items={crumbs.items} />
  )
}
