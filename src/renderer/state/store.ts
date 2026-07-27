import { create } from 'zustand'
import type { ModelStats, ScanResult } from '../../shared/types'
import { api } from '../ipc/api'
import type { MaterialPreset } from '../viewer/materials'
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
  baseColor: '#b0b6be',
  background: 'dark',
  showGrid: false,
  autoRotate: false,
  currentStats: null,

  openFolder: async (dir) => {
    const scan = await api.scanFolder(dir)
    set({ cwd: dir, scan, selectedIndex: null, search: '', activeTags: [] })
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
}))
