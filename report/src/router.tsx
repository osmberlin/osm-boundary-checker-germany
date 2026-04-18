import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { ReportLayout } from './App'
import { routerBasePath } from './data/paths'
import { AreaReport } from './pages/AreaReport'
import { FeatureDetail } from './pages/FeatureDetail'
import { Home } from './pages/Home'
import { ProcessingStatus } from './pages/ProcessingStatus'
import { UnmatchedReport } from './pages/UnmatchedReport'

const rootRoute = createRootRoute({
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

const unmatchedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/$areaId/unmatched',
  component: UnmatchedReport,
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
  unmatchedRoute,
  featureRoute,
  fallbackRoute,
])

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  basepath: routerBasePath(),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
