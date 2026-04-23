import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  defaultParseSearch,
  redirect,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ReportLayout } from './App'
import { areasIndexQueryOptions } from './data/areasIndexQuery'
import { comparisonQueryOptions, featureQueryOptions, snapshotsQueryOptions } from './data/load'
import { routerBasePath } from './data/paths'
import { stringifySearchPretty } from './lib/routerSearchStringify'
import { AreaReport } from './pages/AreaReport'
import { FeatureDetail } from './pages/FeatureDetail'
import { Home } from './pages/Home'
import { ProcessingStatus } from './pages/ProcessingStatus'

export type RouterContext = {
  queryClient: QueryClient
}

export const rootRoute = createRootRouteWithContext<RouterContext>()({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(areasIndexQueryOptions())
  },
  component: ReportLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
})

const statusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/status',
  component: ProcessingStatus,
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
  component: AreaReport,
})

const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$areaId/feature/$featureKey',
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(featureQueryOptions(params.areaId, params.featureKey))
  },
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
