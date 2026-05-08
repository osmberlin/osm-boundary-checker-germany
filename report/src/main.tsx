import '@fontsource-variable/inter/wght.css'
import './lib/pmtilesMaplibreRegister'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createAppRouter } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 6 * 60 * 60 * 1000,
    },
  },
})
const router = createAppRouter(queryClient)

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Missing root element with id "root"')
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
