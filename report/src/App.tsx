import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppFooter } from './components/AppFooter'
import { PageBreadcrumb } from './components/PageBreadcrumb'
import { AreaReport } from './pages/AreaReport'
import { FeatureDetail } from './pages/FeatureDetail'
import { Home } from './pages/Home'
import { ProcessingStatus } from './pages/ProcessingStatus'
import { UnmatchedReport } from './pages/UnmatchedReport'

function ReportLayout() {
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-zinc-800 focus:p-2 focus:text-zinc-100"
      >
        Zum Inhalt
      </a>
      <header>
        <PageBreadcrumb />
      </header>
      <main id="main" className="min-h-[70vh]">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <NuqsAdapter>
        <Routes>
          <Route element={<ReportLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/status" element={<ProcessingStatus />} />
            <Route path="/:areaId" element={<AreaReport />} />
            <Route path="/:areaId/unmatched" element={<UnmatchedReport />} />
            <Route path="/:areaId/feature/:featureKey" element={<FeatureDetail />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </NuqsAdapter>
    </BrowserRouter>
  )
}
