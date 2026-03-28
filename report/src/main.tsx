import '@fontsource-variable/inter/wght.css'
import './lib/pmtilesMaplibreRegister'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { de } from './i18n/de'

document.title = de.appTitle

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Missing root element with id "root"')
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
