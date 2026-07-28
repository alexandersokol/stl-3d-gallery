import { create } from 'zustand'
import type { Metadata, ModelStats, ScanResult } from '../../shared/types'
import { api } from '../ipc/api'
import { DEFAULT_BASE_COLOR, MATERIAL_PRESETS, type MaterialPreset } from '../viewer/materials'
import type { LightPreset } from '../viewer/lighting'
import { UI_THEME_STORAGE_KEY, readStoredUiTheme, type UiTheme } from '../theme'

export type { UiTheme }
export type Mode = 'grid' | 'viewer'

// Persists the app-chrome theme (panels/bars/cards -- NOT the viewer's
// scene background, which is the separate `background` field below) across
// restarts. Read synchronously at module load so the store's initial state
// already reflects the user's last choice. The key/read logic lives in
// ../theme (shared with main.tsx's pre-mount `applyStoredThemeSync`, which
// stamps documentElement[data-theme] before first paint) -- they must stay
// in lockstep, hence the shared helper rather than a second copy here.

// Persists the configured thumbnail-rendering material preset (separate
// from `material`, which is the live 3D-preview material) across restarts,
// the same way `uiTheme` is persisted above. A future Settings screen will
// expose a picker for this; this store field/default is the plumbing it
// will drive.
const THUMBNAIL_PRESET_STORAGE_KEY = 'stl-gallery:thumbnailPreset'

function readStoredThumbnailPreset(): MaterialPreset {
  try {
    const stored = localStorage.getItem(THUMBNAIL_PRESET_STORAGE_KEY)
    return stored && (MATERIAL_PRESETS as string[]).includes(stored) ? (stored as MaterialPreset) : 'clay'
  } catch {
    return 'clay'
  }
}

export interface UiState {
  cwd: string | null
  scan: ScanResult | null
  selectedIndex: number | null
  mode: Mode
  uiTheme: UiTheme
  showFilmstrip: boolean
  showInfo: boolean
  search: string
  activeTags: string[]
  includeSubfolders: boolean
  material: MaterialPreset
  // Material preset used when rendering grid thumbnails -- independent of
  // `material` above (the live 3D-preview material). Defaults to 'clay' and
  // persists to localStorage; a future Settings screen will expose a picker
  // for it.
  thumbnailPreset: MaterialPreset
  lighting: LightPreset
  lightIntensity: number
  baseColor: string
  background: 'light' | 'dark'
  showGrid: boolean
  autoRotate: boolean
  currentStats: ModelStats | null
  // Per-file metadata (tags/notes/etc) keyed by absolute path. Populated by
  // InfoPanel whenever it reads or writes a file's metadata, so the filter
  // bar (Task 5.2) can read tags for the whole folder without re-reading
  // every metadata.json off disk itself.
  metaByPath: Record<string, Metadata>
  // Bumped (never read directly for its value) whenever the toolbar's
  // "Reset camera" button is clicked. Viewer watches this via an effect and
  // calls SceneManager.resetCamera() -- a plain store action can't reach
  // into the imperative three.js engine directly, so this is the signal
  // that bridges the two.
  resetCameraSignal: number
  openFolder(dir: string): Promise<void>
  select(index: number): void
  next(): void
  prev(): void
  setMode(m: Mode): void
  toggleUiTheme(): void
  toggleFilmstrip(): void
  toggleInfo(): void
  setSearch(s: string): void
  toggleTag(t: string): void
  setIncludeSubfolders(b: boolean): void
  setMaterial(preset: MaterialPreset): void
  setThumbnailPreset(preset: MaterialPreset): void
  setLighting(preset: LightPreset): void
  setLightIntensity(n: number): void
  setBaseColor(s: string): void
  setBackground(m: 'light' | 'dark'): void
  toggleGrid(): void
  toggleAutoRotate(): void
  setCurrentStats(stats: ModelStats | null): void
  setMeta(path: string, meta: Metadata): void
  requestResetCamera(): void
}

export const useUiStore = create<UiState>((set, get) => ({
  cwd: null,
  scan: null,
  selectedIndex: null,
  mode: 'grid',
  uiTheme: readStoredUiTheme(),
  showFilmstrip: true,
  showInfo: true,
  search: '',
  activeTags: [],
  includeSubfolders: false,
  material: 'clay',
  thumbnailPreset: readStoredThumbnailPreset(),
  lighting: 'studio',
  lightIntensity: 1,
  baseColor: DEFAULT_BASE_COLOR,
  background: 'dark',
  showGrid: false,
  autoRotate: false,
  currentStats: null,
  metaByPath: {},
  resetCameraSignal: 0,

  openFolder: async (dir) => {
    const scan = await api.scanFolder(dir)
    set({ cwd: dir, scan, selectedIndex: null, search: '', activeTags: [] })

    // Batch-load metadata (tags/notes) for every file in the folder so the
    // search/tag filter bar (Task 5.2b) has tags to filter on without the
    // user having to open each model individually. The folder is already
    // "open" by this point (cwd/scan committed above), so a failure here
    // (e.g. disk error) must not prevent browsing -- just proceed with
    // whatever metadata each file's tile picks up later via InfoPanel.
    let meta: Record<string, Metadata> = {}
    try {
      meta = await api.readMetadataBatch(scan.files.map((f) => f.path))
    } catch (err) {
      console.error(`openFolder: failed to batch-read metadata for ${dir}`, err)
    }
    set((s) => ({ metaByPath: { ...s.metaByPath, ...meta } }))
  },

  select: (index) => set({ selectedIndex: index, mode: 'viewer' }),

  next: () => {
    const { selectedIndex, scan } = get()
    if (selectedIndex === null || scan === null) return
    if (selectedIndex >= scan.files.length - 1) return
    set({ selectedIndex: selectedIndex + 1 })
  },

  prev: () => {
    const { selectedIndex, scan } = get()
    if (selectedIndex === null || scan === null) return
    if (selectedIndex <= 0) return
    set({ selectedIndex: selectedIndex - 1 })
  },

  setMode: (m) => set({ mode: m }),
  toggleUiTheme: () =>
    set((s) => {
      const next: UiTheme = s.uiTheme === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(UI_THEME_STORAGE_KEY, next)
      } catch {
        // Storage may be unavailable -- the toggle still applies for the
        // current session, it just won't survive a restart.
      }
      return { uiTheme: next }
    }),
  toggleFilmstrip: () => set((s) => ({ showFilmstrip: !s.showFilmstrip })),
  toggleInfo: () => set((s) => ({ showInfo: !s.showInfo })),
  setSearch: (s) => set({ search: s }),
  toggleTag: (t) => set((s) => ({
    activeTags: s.activeTags.includes(t)
      ? s.activeTags.filter((tag) => tag !== t)
      : [...s.activeTags, t],
  })),
  setIncludeSubfolders: (b) => set({ includeSubfolders: b }),
  setMaterial: (preset) => set({ material: preset }),
  setThumbnailPreset: (preset) =>
    set(() => {
      try {
        localStorage.setItem(THUMBNAIL_PRESET_STORAGE_KEY, preset)
      } catch {
        // Storage may be unavailable -- the choice still applies for the
        // current session, it just won't survive a restart.
      }
      return { thumbnailPreset: preset }
    }),
  setLighting: (preset) => set({ lighting: preset }),
  setLightIntensity: (n) => set({ lightIntensity: n }),
  setBaseColor: (s) => set({ baseColor: s }),
  setBackground: (m) => set({ background: m }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  setCurrentStats: (stats) => set({ currentStats: stats }),
  setMeta: (path, meta) => set((s) => ({ metaByPath: { ...s.metaByPath, [path]: meta } })),
  requestResetCamera: () => set((s) => ({ resetCameraSignal: s.resetCameraSignal + 1 })),
}))
