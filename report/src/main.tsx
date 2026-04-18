import '@fontsource-variable/inter/wght.css'
import './lib/pmtilesMaplibreRegister'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { de } from './i18n/de'
import { router } from './router'

document.title = de.appTitle

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Missing root element with id "root"')
}

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
