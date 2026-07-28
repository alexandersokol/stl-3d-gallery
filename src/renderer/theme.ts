// Shared source of truth for the persisted app-chrome theme, so the
// pre-mount sync application (main.tsx) and the zustand store's initial
// state (state/store.ts) can never drift onto different localStorage keys
// or different fallback defaults.

export type UiTheme = 'light' | 'dark'

export const UI_THEME_STORAGE_KEY = 'stl-gallery:uiTheme'

// Reads the persisted theme choice. Defaults to 'dark' when absent or on
// any error (e.g. localStorage disabled) -- never let theme init crash the
// app.
export function readStoredUiTheme(): UiTheme {
  try {
    return localStorage.getItem(UI_THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

// Stamps `data-theme` onto <html> SYNCHRONOUSLY, before React mounts (see
// main.tsx). This must happen as part of the bundled entry module -- not an
// inline <script> in index.html -- because production builds ship a CSP of
// `script-src 'self'` with no `unsafe-inline`, which would silently block an
// inline script. Running it here, before `createRoot(...).render(...)`,
// means the attribute is set before the first paint, eliminating the
// dark->light (or light->dark) flash that a passive `useEffect` in App.tsx
// would otherwise cause (effects run post-paint).
export function applyStoredThemeSync(): void {
  try {
    const theme = readStoredUiTheme()
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
  } catch {
    // Belt-and-suspenders: readStoredUiTheme already can't throw, but keep
    // this defensive so a future change there can't take down app boot.
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}
