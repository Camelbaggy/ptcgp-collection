import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setupPwaUpdates } from './lib/pwaUpdate'
import './styles.css'
import App from './App.tsx'
import { applyTheme, getTheme } from './lib/theme'

applyTheme(getTheme())
setupPwaUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
