import { useEffect } from 'react'
import './app.css'
import { useUiStore } from './state/store'
import { useOpenFile } from './hooks/useOpenFile'
import EmptyState from './components/EmptyState'
import Breadcrumbs from './components/Breadcrumbs'
import SearchBox from './components/SearchBox'
import TagFilterBar from './components/TagFilterBar'
import GridView from './components/GridView'
import Viewer from './components/Viewer'
import ViewerToolbar from './components/ViewerToolbar'
import Filmstrip from './components/Filmstrip'
import InfoPanel from './components/InfoPanel'
import SettingsModal from './components/SettingsModal'
import {
  GridViewIcon,
  ViewInArIcon,
  ViewCarouselIcon,
  VisibilityIcon,
  DarkModeIcon,
  LightModeIcon,
  SettingsIcon,
} from './assets/icons'

// True when the keyboard event originated in something the user is typing
// into (a text field, the color/range toolbar inputs, or a contentEditable
// region) -- shortcuts below must not hijack those keystrokes.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export default function App() {
  const cwd = useUiStore((s) => s.cwd)
  const mode = useUiStore((s) => s.mode)
  const setMode = useUiStore((s) => s.setMode)
  const uiTheme = useUiStore((s) => s.uiTheme)
  const toggleUiTheme = useUiStore((s) => s.toggleUiTheme)
  const showFilmstrip = useUiStore((s) => s.showFilmstrip)
  const showInfo = useUiStore((s) => s.showInfo)
  const toggleFilmstrip = useUiStore((s) => s.toggleFilmstrip)
  const toggleInfo = useUiStore((s) => s.toggleInfo)
  const openSettings = useUiStore((s) => s.openSettings)

  // Subscribes once to the main process's forwarded 'open-file' path (a
  // single .stl opened from the OS -- Task 7.1) and opens its parent folder,
  // selecting the file within it.
  useOpenFile()

  // Stamps the app-chrome theme onto <html> so app.css's
  // `:root[data-theme="..."]` token blocks apply. The initial paint is
  // already correct because main.tsx's `applyStoredThemeSync()` sets the
  // attribute synchronously before this component ever mounts (see
  // ../theme.ts) -- this effect only has to keep the attribute in sync when
  // the user toggles afterward.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', uiTheme)
  }, [uiTheme])

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
            <GridViewIcon />
            Grid
          </button>
          <button type="button" aria-pressed={mode === 'viewer'} onClick={() => setMode('viewer')}>
            <ViewInArIcon />
            Viewer
          </button>
        </div>
        <button
          type="button"
          className="theme-toggle-button"
          aria-label="Toggle theme"
          aria-pressed={uiTheme === 'light'}
          title={uiTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleUiTheme}
        >
          {uiTheme === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
        </button>
        <button
          type="button"
          className="settings-button"
          aria-label="Settings"
          title="Settings"
          onClick={openSettings}
        >
          <SettingsIcon />
        </button>
        {mode === 'grid' && (
          <div className="grid-filters">
            <SearchBox />
            <TagFilterBar />
          </div>
        )}
        {mode === 'viewer' && (
          <div className="pane-toggles" role="group" aria-label="Panels">
            <button type="button" aria-pressed={showFilmstrip} onClick={toggleFilmstrip}>
              <ViewCarouselIcon />
              Filmstrip
            </button>
            <button type="button" aria-pressed={showInfo} onClick={toggleInfo}>
              <VisibilityIcon />
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
          {showInfo && <InfoPanel />}
        </div>
      )}

      <SettingsModal />
    </div>
  )
}
