import {
  createRootRoute,
  createRoute,
  createRouter,
  defaultParseSearch,
  redirect,
} from '@tanstack/react-router'
import { ReportLayout } from './App'
import { loadAreasIndex } from './data/areasIndexQuery'
import { routerBasePath } from './data/paths'
import { stringifySearchPretty } from './lib/routerSearchStringify'
import { AreaReport } from './pages/AreaReport'
import { FeatureDetail } from './pages/FeatureDetail'
import { Home } from './pages/Home'
import { ProcessingStatus } from './pages/ProcessingStatus'

export const rootRoute = createRootRoute({
  loader: async () => ({ areasIndex: await loadAreasIndex() }),
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
  component: AreaReport,
})

const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$areaId/feature/$featureKey',
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

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  basepath: routerBasePath(),
  parseSearch: defaultParseSearch,
  stringifySearch: stringifySearchPretty,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
