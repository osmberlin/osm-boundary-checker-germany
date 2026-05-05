import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  defaultParseSearch,
  redirect,
} from '@tanstack/react-router'
import { ReportLayout } from './App'
import { comparisonQueryOptions, featureQueryOptions, snapshotsQueryOptions } from './data/load'
import { routerBasePath } from './data/paths'
import { de } from './i18n/de'
import { validateGermanKeySearch } from './lib/germanKeySearch'
import { areaDisplayNameForId, featureNameLabelFromData } from './lib/reportLookups'
import { stringifySearchPretty } from './lib/routerSearchStringify'
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
  loader: async ({ context, params }) => {
    return context.queryClient.ensureQueryData(
      featureQueryOptions(params.areaId, params.featureKey),
    )
  },
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
