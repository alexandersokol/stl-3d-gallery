import { createRoot } from 'react-dom/client'
import App from './App'
import { applyStoredThemeSync } from './theme'

// Must run before React mounts (and therefore before first paint) so the
// app-chrome theme is correct on the very first frame -- see theme.ts for
// why this can't just live in App's effect or an inline <script>.
applyStoredThemeSync()

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

createRoot(container).render(<App />)
