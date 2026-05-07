import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  defaultParseSearch,
  redirect,
  useParams,
} from '@tanstack/react-router'
import { ReportLayout } from './App'
import { RouteLoadingPane } from './components/RouteLoadingPane'
import { areasIndex } from './data/areasIndex'
import { comparisonQueryOptions, featureQueryOptions, snapshotsQueryOptions } from './data/load'
import { routerBasePath } from './data/paths'
import { de } from './i18n/de'
import { validateFeatureDetailSearch } from './lib/featureDetailSearch'
import { validateGermanKeySearch } from './lib/germanKeySearch'
import { areaDisplayNameForId, featureNameLabelFromData } from './lib/reportLookups'
import { stringifySearchPretty } from './lib/routerSearchStringify'
import { safeDecodeURIComponent } from './lib/safeDecodeURIComponent'
import { socialSharingImageAbsoluteUrl } from './lib/siteBasePath'
import { AreaReport } from './pages/AreaReport'
import { Changelog } from './pages/Changelog'
import { FeatureDetail } from './pages/FeatureDetail'
import { GermanKeyExplorer } from './pages/GermanKeyExplorer'
import { Home } from './pages/Home'
import { ProcessingStatus } from './pages/ProcessingStatus'
import { ReviewQueue } from './pages/ReviewQueue'
import type { ComparisonForReport } from './types/report'

export type RouterContext = {
  queryClient: QueryClient
}

function featureTitleFromData(data: ComparisonForReport | undefined, featureKey: string): string {
  if (!data) return featureKey
  return `${data.titlePrefix} ${featureNameLabelFromData(data, featureKey) ?? featureKey}`.trim()
}

/** Pending UI for `/$areaId`: shows area name + total row count from the bundled `areasIndex`. */
function AreaPendingPane() {
  const { areaId } = useParams({ strict: false })
  const areaKey = areaId ?? ''
  const summary = areasIndex.summaries.find((entry) => entry.area === areaKey)
  const displayName = summary?.displayName ?? areaDisplayNameForId(areaKey)
  const totalRows = summary ? summary.matched + summary.officialOnly + summary.unmatchedOsm : null
  return (
    <RouteLoadingPane
      title={de.routeLoading.area(displayName, totalRows)}
      subtitle={de.routeLoading.areaSubtitle}
    />
  )
}

/** Pending UI for `/$areaId/feature/$featureKey`: decoded canonicalMatchKey only. */
function FeaturePendingPane() {
  const { featureKey } = useParams({ strict: false })
  const decoded = featureKey ? safeDecodeURIComponent(featureKey) : ''
  return <RouteLoadingPane title={de.routeLoading.feature(decoded)} />
}

const socialImageUrl = socialSharingImageAbsoluteUrl()

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: ReportLayout,
  head: () => ({
    meta: [
      { name: 'description', content: de.home.metaDescription },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: de.appTitle },
      { property: 'og:title', content: de.appTitle },
      { property: 'og:description', content: de.home.metaDescription },
      { property: 'og:image', content: socialImageUrl },
      { property: 'og:image:type', content: 'image/png' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:image', content: socialImageUrl },
    ],
  }),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  head: () => ({
    meta: [{ title: de.appTitle }],
  }),
  component: Home,
})

const statusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/status',
  head: () => ({
    meta: [
      { title: `${de.status.title} | ${de.appTitle}` },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: ProcessingStatus,
})

const changelogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/changelog',
  head: () => ({
    meta: [{ title: `${de.changelog.heading} | ${de.appTitle}` }],
  }),
  component: Changelog,
})

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  head: () => ({
    meta: [{ title: `${de.review.title} | ${de.appTitle}` }],
  }),
  component: ReviewQueue,
})

const germanKeyExplorerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tools/german-key',
  validateSearch: (search: Record<string, unknown>) => validateGermanKeySearch(search),
  head: () => ({
    meta: [
      { title: `${de.germanKeyExplorer.metaTitle} | ${de.appTitle}` },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: GermanKeyExplorer,
})

const areaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$areaId',
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(comparisonQueryOptions(params.areaId)),
      context.queryClient.ensureQueryData(snapshotsQueryOptions(params.areaId)),
    ])
  },
  pendingComponent: AreaPendingPane,
  head: ({ params }) => ({
    meta: [
      { title: `${areaDisplayNameForId(params.areaId)} | ${de.appTitle}` },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: AreaReport,
})

const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$areaId/feature/$featureKey',
  validateSearch: (search: Record<string, unknown>) => validateFeatureDetailSearch(search),
  loader: async ({ context, params }) => {
    return context.queryClient.ensureQueryData(
      featureQueryOptions(params.areaId, params.featureKey),
    )
  },
  pendingComponent: FeaturePendingPane,
  head: ({ params, loaderData }) => ({
    meta: [{ title: `${featureTitleFromData(loaderData, params.featureKey)} | ${de.appTitle}` }],
  }),
  component: FeatureDetail,
})

const fallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/*',
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
  component: () => null,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  statusRoute,
  changelogRoute,
  reviewRoute,
  germanKeyExplorerRoute,
  areaRoute,
  featureRoute,
  fallbackRoute,
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    /** Show route-level `pendingComponent` immediately (default is 1000ms). */
    defaultPendingMs: 0,
    /** Once shown, hold the spinner ≥300ms to avoid a flash on fast networks. */
    defaultPendingMinMs: 300,
    basepath: routerBasePath(),
    parseSearch: defaultParseSearch,
    stringifySearch: stringifySearchPretty,
  })
}

export type AppRouter = ReturnType<typeof createAppRouter>

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
