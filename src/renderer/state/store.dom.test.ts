// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FileEntry, Metadata, ModelStats, ScanResult } from '../../shared/types'
import { DEFAULT_BASE_COLOR } from '../viewer/materials'

const files: FileEntry[] = [
  { path: '/x/a.stl', name: 'a.stl', size: 1, mtimeMs: 1 },
  { path: '/x/b.stl', name: 'b.stl', size: 1, mtimeMs: 2 },
  { path: '/x/c.stl', name: 'c.stl', size: 1, mtimeMs: 3 },
]
const scanResult: ScanResult = { folders: [], files }

const scanFolder = vi.fn().mockResolvedValue(scanResult)
vi.mock('../ipc/api', () => ({ api: { scanFolder: (...args: unknown[]) => scanFolder(...args) } }))

const { useUiStore } = await import('./store')

beforeEach(() => {
  scanFolder.mockClear()
  scanFolder.mockResolvedValue(scanResult)
  useUiStore.setState(useUiStore.getInitialState())
})

describe('useUiStore', () => {
  it('has the expected initial state', () => {
    const s = useUiStore.getState()
    expect(s.cwd).toBeNull()
    expect(s.scan).toBeNull()
    expect(s.selectedIndex).toBeNull()
    expect(s.mode).toBe('grid')
    expect(s.showFilmstrip).toBe(true)
    expect(s.showInfo).toBe(true)
    expect(s.search).toBe('')
    expect(s.activeTags).toEqual([])
    expect(s.includeSubfolders).toBe(false)
    expect(s.material).toBe('clay')
    expect(s.thumbnailPreset).toBe('clay')
    expect(s.cameraMode).toBe('fly')
    expect(s.settingsOpen).toBe(false)
    expect(s.lighting).toBe('studio')
    expect(s.lightIntensity).toBe(1)
    expect(s.baseColor).toBe(DEFAULT_BASE_COLOR)
    expect(s.background).toBe('dark')
    expect(s.showGrid).toBe(false)
    expect(s.autoRotate).toBe(false)
    expect(s.currentStats).toBeNull()
    expect(s.metaByPath).toEqual({})
    expect(s.resetCameraSignal).toBe(0)
    expect(s.uiTheme).toBe('dark')
  })

  it('openFolder scans, sets cwd/scan, and resets selection/search/tags', async () => {
    useUiStore.setState({ selectedIndex: 2, search: 'x', activeTags: ['t'], mode: 'grid' })
    await useUiStore.getState().openFolder('/x')
    expect(scanFolder).toHaveBeenCalledWith('/x')
    const s = useUiStore.getState()
    expect(s.cwd).toBe('/x')
    expect(s.scan).toEqual(scanResult)
    expect(s.selectedIndex).toBeNull()
    expect(s.search).toBe('')
    expect(s.activeTags).toEqual([])
    expect(s.mode).toBe('grid')
  })

  it('openFolder keeps mode', async () => {
    useUiStore.setState({ mode: 'viewer' })
    await useUiStore.getState().openFolder('/x')
    expect(useUiStore.getState().mode).toBe('viewer')
  })

  it('select sets selectedIndex and switches mode to viewer', async () => {
    await useUiStore.getState().openFolder('/x')
    useUiStore.getState().select(1)
    const s = useUiStore.getState()
    expect(s.selectedIndex).toBe(1)
    expect(s.mode).toBe('viewer')
  })

  it('next/prev walk the full scan.files list and clamp at bounds', async () => {
    await useUiStore.getState().openFolder('/x')
    useUiStore.getState().select(0)
    useUiStore.getState().prev()
    expect(useUiStore.getState().selectedIndex).toBe(0) // clamped, no-op below 0

    useUiStore.getState().next()
    expect(useUiStore.getState().selectedIndex).toBe(1)
    useUiStore.getState().next()
    expect(useUiStore.getState().selectedIndex).toBe(2) // last index (3 files)
    useUiStore.getState().next()
    expect(useUiStore.getState().selectedIndex).toBe(2) // clamped, no-op past last

    useUiStore.getState().prev()
    expect(useUiStore.getState().selectedIndex).toBe(1)
  })

  it('next/prev are no-ops when nothing is selected or no scan yet', () => {
    useUiStore.getState().next()
    expect(useUiStore.getState().selectedIndex).toBeNull()
    useUiStore.getState().prev()
    expect(useUiStore.getState().selectedIndex).toBeNull()
  })

  it('next/prev are no-ops when selectedIndex is set but scan is null', () => {
    useUiStore.setState({ selectedIndex: 1, scan: null })
    useUiStore.getState().next()
    expect(useUiStore.getState().selectedIndex).toBe(1)
    useUiStore.getState().prev()
    expect(useUiStore.getState().selectedIndex).toBe(1)
  })

  it('toggleTag adds then removes a tag', () => {
    useUiStore.getState().toggleTag('mechanical')
    expect(useUiStore.getState().activeTags).toEqual(['mechanical'])
    useUiStore.getState().toggleTag('mechanical')
    expect(useUiStore.getState().activeTags).toEqual([])
  })

  it('setMode, toggleFilmstrip, toggleInfo, setSearch, setIncludeSubfolders behave as simple setters/toggles', () => {
    useUiStore.getState().setMode('viewer')
    expect(useUiStore.getState().mode).toBe('viewer')

    useUiStore.getState().toggleFilmstrip()
    expect(useUiStore.getState().showFilmstrip).toBe(false)
    useUiStore.getState().toggleFilmstrip()
    expect(useUiStore.getState().showFilmstrip).toBe(true)

    useUiStore.getState().toggleInfo()
    expect(useUiStore.getState().showInfo).toBe(false)

    useUiStore.getState().setSearch('bunny')
    expect(useUiStore.getState().search).toBe('bunny')

    useUiStore.getState().setIncludeSubfolders(true)
    expect(useUiStore.getState().includeSubfolders).toBe(true)
  })

  it('setMaterial and setLighting update the respective preset fields', () => {
    useUiStore.getState().setMaterial('metal')
    expect(useUiStore.getState().material).toBe('metal')

    useUiStore.getState().setLighting('dramatic')
    expect(useUiStore.getState().lighting).toBe('dramatic')
  })

  it('setThumbnailPreset defaults to clay, updates the field, and persists the choice to localStorage', () => {
    expect(useUiStore.getState().thumbnailPreset).toBe('clay')

    useUiStore.getState().setThumbnailPreset('ceramic')
    expect(useUiStore.getState().thumbnailPreset).toBe('ceramic')
    expect(localStorage.getItem('stl-gallery:thumbnailPreset')).toBe('ceramic')

    useUiStore.getState().setThumbnailPreset('clay')
    expect(useUiStore.getState().thumbnailPreset).toBe('clay')
    expect(localStorage.getItem('stl-gallery:thumbnailPreset')).toBe('clay')
  })

  it('setCameraMode defaults to fly, updates the field, and persists the choice to localStorage', () => {
    expect(useUiStore.getState().cameraMode).toBe('fly')

    useUiStore.getState().setCameraMode('surface')
    expect(useUiStore.getState().cameraMode).toBe('surface')
    expect(localStorage.getItem('stl-gallery:cameraMode')).toBe('surface')

    useUiStore.getState().setCameraMode('fly')
    expect(useUiStore.getState().cameraMode).toBe('fly')
    expect(localStorage.getItem('stl-gallery:cameraMode')).toBe('fly')
  })

  it('openSettings/closeSettings toggle settingsOpen', () => {
    expect(useUiStore.getState().settingsOpen).toBe(false)

    useUiStore.getState().openSettings()
    expect(useUiStore.getState().settingsOpen).toBe(true)

    useUiStore.getState().closeSettings()
    expect(useUiStore.getState().settingsOpen).toBe(false)
  })

  it('setLightIntensity, setBaseColor, setBackground behave as simple setters', () => {
    useUiStore.getState().setLightIntensity(1.5)
    expect(useUiStore.getState().lightIntensity).toBe(1.5)

    useUiStore.getState().setBaseColor('#ff0000')
    expect(useUiStore.getState().baseColor).toBe('#ff0000')

    useUiStore.getState().setBackground('light')
    expect(useUiStore.getState().background).toBe('light')
  })

  it('toggleGrid and toggleAutoRotate flip their booleans', () => {
    useUiStore.getState().toggleGrid()
    expect(useUiStore.getState().showGrid).toBe(true)
    useUiStore.getState().toggleGrid()
    expect(useUiStore.getState().showGrid).toBe(false)

    useUiStore.getState().toggleAutoRotate()
    expect(useUiStore.getState().autoRotate).toBe(true)
    useUiStore.getState().toggleAutoRotate()
    expect(useUiStore.getState().autoRotate).toBe(false)
  })

  it('requestResetCamera increments resetCameraSignal each call', () => {
    expect(useUiStore.getState().resetCameraSignal).toBe(0)

    useUiStore.getState().requestResetCamera()
    expect(useUiStore.getState().resetCameraSignal).toBe(1)

    useUiStore.getState().requestResetCamera()
    expect(useUiStore.getState().resetCameraSignal).toBe(2)
  })

  it('setCurrentStats stores the model stats for the InfoPanel to read later', () => {
    const stats: ModelStats = { triCount: 10, vertCount: 6, bbox: { x: 1, y: 2, z: 3 } }
    useUiStore.getState().setCurrentStats(stats)
    expect(useUiStore.getState().currentStats).toEqual(stats)

    useUiStore.getState().setCurrentStats(null)
    expect(useUiStore.getState().currentStats).toBeNull()
  })

  it('toggleUiTheme flips uiTheme and persists the choice to localStorage', () => {
    expect(useUiStore.getState().uiTheme).toBe('dark')

    useUiStore.getState().toggleUiTheme()
    expect(useUiStore.getState().uiTheme).toBe('light')
    expect(localStorage.getItem('stl-gallery:uiTheme')).toBe('light')

    useUiStore.getState().toggleUiTheme()
    expect(useUiStore.getState().uiTheme).toBe('dark')
    expect(localStorage.getItem('stl-gallery:uiTheme')).toBe('dark')
  })

  it('setMeta stores metadata keyed by path, without clobbering other paths', () => {
    const metaA: Metadata = { schemaVersion: 1, tags: ['a'], notes: 'first', updatedAt: '2024-01-01T00:00:00.000Z' }
    const metaB: Metadata = { schemaVersion: 1, tags: ['b'], notes: 'second', updatedAt: '2024-01-02T00:00:00.000Z' }

    useUiStore.getState().setMeta('/x/a.stl', metaA)
    expect(useUiStore.getState().metaByPath).toEqual({ '/x/a.stl': metaA })

    useUiStore.getState().setMeta('/x/b.stl', metaB)
    expect(useUiStore.getState().metaByPath).toEqual({ '/x/a.stl': metaA, '/x/b.stl': metaB })

    const metaAUpdated: Metadata = { ...metaA, notes: 'updated' }
    useUiStore.getState().setMeta('/x/a.stl', metaAUpdated)
    expect(useUiStore.getState().metaByPath).toEqual({ '/x/a.stl': metaAUpdated, '/x/b.stl': metaB })
  })
})
