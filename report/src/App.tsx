import { HeadContent, Outlet } from '@tanstack/react-router'
import { AppFooter } from './components/AppFooter'
import { PageBreadcrumb } from './components/PageBreadcrumb'

export function ReportLayout() {
  return (
    <div className="min-h-screen">
      <HeadContent />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-slate-800 focus:p-2 focus:text-slate-100"
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
