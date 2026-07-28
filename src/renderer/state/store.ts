import { create } from 'zustand'
import type { Metadata, ModelStats, ScanResult } from '../../shared/types'
import { api } from '../ipc/api'
import { DEFAULT_BASE_COLOR, MATERIAL_PRESETS, type MaterialPreset } from '../viewer/materials'
import type { LightPreset } from '../viewer/lighting'
import { UI_THEME_STORAGE_KEY, readStoredUiTheme, type UiTheme } from '../theme'

export type { UiTheme }
export type Mode = 'grid' | 'viewer'
export type FileActionKind = 'rename' | 'copy' | 'delete'

// Persists the app-chrome theme (panels/bars/cards -- NOT the viewer's
// scene background, which is the separate `background` field below) across
// restarts. Read synchronously at module load so the store's initial state
// already reflects the user's last choice. The key/read logic lives in
// ../theme (shared with main.tsx's pre-mount `applyStoredThemeSync`, which
// stamps documentElement[data-theme] before first paint) -- they must stay
// in lockstep, hence the shared helper rather than a second copy here.

// Persists the configured thumbnail-rendering material preset (separate
// from `material`, which is the live 3D-preview material) across restarts,
// the same way `uiTheme` is persisted above. Exposed via the Settings screen
// (SettingsModal.tsx).
const THUMBNAIL_PRESET_STORAGE_KEY = 'stl-gallery:thumbnailPreset'

function readStoredThumbnailPreset(): MaterialPreset {
  try {
    const stored = localStorage.getItem(THUMBNAIL_PRESET_STORAGE_KEY)
    return stored && (MATERIAL_PRESETS as string[]).includes(stored) ? (stored as MaterialPreset) : 'studio'
  } catch {
    return 'studio'
  }
}

// Persists the viewer's camera navigation mode across restarts, the same
// way `uiTheme`/`thumbnailPreset` are persisted above. Exposed via the
// Settings screen (SettingsModal.tsx); driven into the live engine by
// Viewer.tsx calling SceneManager.setCameraMode().
export type CameraMode = 'fly' | 'surface'
const CAMERA_MODE_STORAGE_KEY = 'stl-gallery:cameraMode'

function readStoredCameraMode(): CameraMode {
  try {
    const stored = localStorage.getItem(CAMERA_MODE_STORAGE_KEY)
    return stored === 'surface' ? 'surface' : 'fly'
  } catch {
    return 'fly'
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
  // Viewer camera navigation mode: 'fly' allows dollying through/inside the
  // model (fly-through inspection); 'surface' stops the camera just outside
  // the model's surface. Defaults to 'fly' and persists to localStorage.
  // Driven into the live SceneManager by Viewer.tsx.
  cameraMode: CameraMode
  // Whether the Settings modal (SettingsModal.tsx) is currently open.
  settingsOpen: boolean
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
  // Drives the rename/copy/delete dialogs (FileActionDialogs). `path` is the
  // model the action targets (the viewer's current model, or a grid tile).
  // Move needs no dialog (it uses the native folder picker) so it isn't
  // represented here. Null when no dialog is open.
  fileAction: { kind: FileActionKind; path: string } | null
  // Transient error message from a file operation with no open dialog to show
  // it (currently just Move); surfaced as a dismissible toast.
  fileActionError: string | null
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
  setCameraMode(mode: CameraMode): void
  openSettings(): void
  closeSettings(): void
  setLighting(preset: LightPreset): void
  setLightIntensity(n: number): void
  setBaseColor(s: string): void
  setBackground(m: 'light' | 'dark'): void
  toggleGrid(): void
  toggleAutoRotate(): void
  setCurrentStats(stats: ModelStats | null): void
  setMeta(path: string, meta: Metadata): void
  requestResetCamera(): void
  // File operations (see file-ops in main). beginFileAction opens a dialog;
  // the confirm* actions run the op then reconcile the folder/selection.
  // moveFile and the confirm* actions may reject so a dialog can show the
  // error; moveFile handles its own error via fileActionError.
  beginFileAction(kind: FileActionKind, path: string): void
  closeFileAction(): void
  dismissFileActionError(): void
  moveFile(path: string): Promise<void>
  confirmRename(newName: string): Promise<void>
  confirmCopy(newName: string): Promise<void>
  confirmDelete(): Promise<void>
  // Refresh the folder and switch the viewer to a just-written model (the
  // repaired `-fixed.stl` produced by the Mesh Repair panel).
  openRepairedFile(path: string): Promise<void>
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
  material: 'solidview',
  thumbnailPreset: readStoredThumbnailPreset(),
  cameraMode: readStoredCameraMode(),
  settingsOpen: false,
  lighting: 'studio',
  lightIntensity: 1,
  baseColor: DEFAULT_BASE_COLOR,
  background: 'dark',
  showGrid: false,
  autoRotate: false,
  currentStats: null,
  metaByPath: {},
  resetCameraSignal: 0,
  fileAction: null,
  fileActionError: null,

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
  setCameraMode: (mode) =>
    set(() => {
      try {
        localStorage.setItem(CAMERA_MODE_STORAGE_KEY, mode)
      } catch {
        // Storage may be unavailable -- the choice still applies for the
        // current session, it just won't survive a restart.
      }
      return { cameraMode: mode }
    }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setLighting: (preset) => set({ lighting: preset }),
  setLightIntensity: (n) => set({ lightIntensity: n }),
  setBaseColor: (s) => set({ baseColor: s }),
  setBackground: (m) => set({ background: m }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  setCurrentStats: (stats) => set({ currentStats: stats }),
  setMeta: (path, meta) => set((s) => ({ metaByPath: { ...s.metaByPath, [path]: meta } })),
  requestResetCamera: () => set((s) => ({ resetCameraSignal: s.resetCameraSignal + 1 })),

  beginFileAction: (kind, path) => set({ fileAction: { kind, path }, fileActionError: null }),
  closeFileAction: () => set({ fileAction: null }),
  dismissFileActionError: () => set({ fileActionError: null }),

  confirmRename: async (newName) => {
    const action = get().fileAction
    if (!action) return
    // Whether we're currently viewing the model being renamed (so we should
    // follow it), vs renaming a grid tile (stay in the grid).
    const s = get()
    const selPath =
      s.scan !== null && s.selectedIndex !== null ? (s.scan.files[s.selectedIndex]?.path ?? null) : null
    const wasViewing = s.mode === 'viewer' && selPath === action.path

    const { path } = await api.renameModel(action.path, newName)
    set({ fileAction: null })
    if (wasViewing) await openAfterOp(path)
    else await rescanKeepingMode()
  },

  confirmCopy: async (newName) => {
    const action = get().fileAction
    if (!action) return
    const { path } = await api.copyModel(action.path, newName)
    set({ fileAction: null })
    await openAfterOp(path) // switch to the new copy
  },

  confirmDelete: async () => {
    const action = get().fileAction
    if (!action) return
    await api.deleteModel(action.path)
    set({ fileAction: null })
    await rescanAfterRemoval()
  },

  moveFile: async (path) => {
    try {
      const res = await api.moveModel(path)
      if (!res) return // user canceled the native folder picker
      await rescanAfterRemoval()
    } catch (err: any) {
      set({ fileActionError: err?.message ?? 'Move failed.' })
    }
  },

  openRepairedFile: async (path) => {
    await openAfterOp(path) // rescan + select the new file in the viewer
  },
}))

// --- Post-operation folder reconciliation -------------------------------
// Defined after the store so they can drive it via getState/setState. They
// run only after an op has already succeeded, so failures here are logged,
// not surfaced (the files are already changed on disk regardless).

async function rescanCwd(): Promise<ScanResult | null> {
  const { cwd } = useUiStore.getState()
  if (!cwd) return null
  const scan = await api.scanFolder(cwd)
  try {
    const meta = await api.readMetadataBatch(scan.files.map((f) => f.path))
    useUiStore.setState((s) => ({ metaByPath: { ...s.metaByPath, ...meta } }))
  } catch (err) {
    console.error('rescanCwd: failed to batch-read metadata', err)
  }
  return scan
}

// Re-scan and open `targetPath` in the viewer (used by copy, and by rename of
// the currently-viewed model). Falls back to a plain refresh if the target
// somehow isn't present.
async function openAfterOp(targetPath: string): Promise<void> {
  try {
    const scan = await rescanCwd()
    if (!scan) return
    const idx = scan.files.findIndex((f) => f.path === targetPath)
    if (idx >= 0) useUiStore.setState({ scan, selectedIndex: idx, mode: 'viewer' })
    else useUiStore.setState({ scan })
  } catch (err) {
    console.error('openAfterOp: failed to refresh folder', err)
  }
}

// Re-scan without changing the current mode/selection semantics (used when
// renaming a grid tile — we stay in the grid).
async function rescanKeepingMode(): Promise<void> {
  try {
    const scan = await rescanCwd()
    if (scan) useUiStore.setState({ scan })
  } catch (err) {
    console.error('rescanKeepingMode: failed to refresh folder', err)
  }
}

// Re-scan after the target model left the folder (move/delete). In the viewer,
// advance to the model now occupying the slot (or back to the grid if the
// folder is empty); in the grid, just refresh the list.
async function rescanAfterRemoval(): Promise<void> {
  try {
    const before = useUiStore.getState()
    const scan = await rescanCwd()
    if (!scan) return
    if (before.mode !== 'viewer') {
      useUiStore.setState({ scan })
      return
    }
    if (scan.files.length === 0) {
      useUiStore.setState({ scan, selectedIndex: null, mode: 'grid' })
      return
    }
    const prev = before.selectedIndex ?? 0
    useUiStore.setState({ scan, selectedIndex: Math.min(prev, scan.files.length - 1) })
  } catch (err) {
    console.error('rescanAfterRemoval: failed to refresh folder', err)
  }
}
