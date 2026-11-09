import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/install'
import { setupPwaUpdates } from './lib/pwaUpdate'
import './styles.css'
import App from './App.tsx'
import { isNative } from './lib/native/holoNative'
import { applyTheme, getTheme } from './lib/theme'

applyTheme(getTheme())
setupPwaUpdates()
if (isNative) void import('./lib/native/boot').then((m) => m.setupNative())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
