import { useEffect } from 'react'
import './app.css'
import { useUiStore } from './state/store'
import EmptyState from './components/EmptyState'
import Breadcrumbs from './components/Breadcrumbs'
import GridView from './components/GridView'
import Viewer from './components/Viewer'
import ViewerToolbar from './components/ViewerToolbar'
import Filmstrip from './components/Filmstrip'

// True when the keyboard event originated in something the user is typing
// into (a text field, the color/range toolbar inputs, or a contentEditable
// region) -- shortcuts below must not hijack those keystrokes.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

// Minimal stand-in for the real InfoPanel (Phase 5). Just enough to occupy
// the info-pane slot in the viewer layout.
function InfoPlaceholder() {
  const scan = useUiStore((s) => s.scan)
  const selectedIndex = useUiStore((s) => s.selectedIndex)
  const file = scan !== null && selectedIndex !== null ? (scan.files[selectedIndex] ?? null) : null

  return (
    <aside className="info-panel" aria-label="Model info">
      <p className="info-panel-filename">{file?.name ?? ''}</p>
      <p className="info-panel-placeholder">Details coming soon</p>
    </aside>
  )
}

export default function App() {
  const cwd = useUiStore((s) => s.cwd)
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const showFilmstrip = useUiStore((s) => s.showFilmstrip)
  const showInfo = useUiStore((s) => s.showInfo)
  const toggleFilmstrip = useUiStore((s) => s.toggleFilmstrip)
  const toggleInfo = useUiStore((s) => s.toggleInfo)

  // Global shortcuts. Reads fresh state via getState() inside the handler
  // (rather than depending on `mode` etc.) so the listener is attached once
  // per mount instead of being torn down/re-added on every store change.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      const state = useUiStore.getState()

      switch (e.key) {
        case 'ArrowRight':
          if (state.mode === 'viewer') state.next()
          break
        case 'ArrowLeft':
          if (state.mode === 'viewer') state.prev()
          break
        case 'Escape':
          if (state.mode === 'viewer') state.setMode('grid')
          break
        case 'f':
        case 'F':
          state.toggleFilmstrip()
          break
        case 'i':
        case 'I':
          state.toggleInfo()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!cwd) {
    return (
      <div className="app">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="top-bar">
        <Breadcrumbs />
        <div className="mode-toggle" role="group" aria-label="View mode">
          <button type="button" aria-pressed={mode === 'grid'} onClick={() => setMode('grid')}>
            Grid
          </button>
          <button type="button" aria-pressed={mode === 'viewer'} onClick={() => setMode('viewer')}>
            Viewer
          </button>
        </div>
        {mode === 'viewer' && (
          <div className="pane-toggles" role="group" aria-label="Panels">
            <button type="button" aria-pressed={showFilmstrip} onClick={toggleFilmstrip}>
              Filmstrip
            </button>
            <button type="button" aria-pressed={showInfo} onClick={toggleInfo}>
              Info
            </button>
          </div>
        )}
      </div>

      {mode === 'grid' ? (
        <GridView />
      ) : (
        <div className="viewer-layout">
          {showFilmstrip && <Filmstrip />}
          <div className="viewer-main">
            <ViewerToolbar />
            <Viewer />
          </div>
          {showInfo && <InfoPlaceholder />}
        </div>
      )}
    </div>
  )
}
