import { create } from 'zustand'
import type { Metadata, ModelStats, ScanResult } from '../../shared/types'
import { api } from '../ipc/api'
import { DEFAULT_BASE_COLOR, type MaterialPreset } from '../viewer/materials'
import type { LightPreset } from '../viewer/lighting'

export type Mode = 'grid' | 'viewer'

export interface UiState {
  cwd: string | null
  scan: ScanResult | null
  selectedIndex: number | null
  mode: Mode
  showFilmstrip: boolean
  showInfo: boolean
  search: string
  activeTags: string[]
  includeSubfolders: boolean
  material: MaterialPreset
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
  toggleFilmstrip(): void
  toggleInfo(): void
  setSearch(s: string): void
  toggleTag(t: string): void
  setIncludeSubfolders(b: boolean): void
  setMaterial(preset: MaterialPreset): void
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
  showFilmstrip: true,
  showInfo: true,
  search: '',
  activeTags: [],
  includeSubfolders: false,
  material: 'matte',
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
