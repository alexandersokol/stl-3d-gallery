// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ScanResult } from '../shared/types'

const scanResult: ScanResult = {
  folders: [{ name: 'sub', path: '/root/sub' }],
  files: [{ name: 'a.stl', path: '/root/a.stl', size: 10, mtimeMs: 1 }],
}

const deepScanResult: ScanResult = {
  folders: [],
  files: [{ name: 'b.stl', path: '/root/sub/leaf/b.stl', size: 20, mtimeMs: 2 }],
}

const twoFileScanResult: ScanResult = {
  folders: [],
  files: [
    { name: 'a.stl', path: '/root/a.stl', size: 10, mtimeMs: 1 },
    { name: 'b.stl', path: '/root/b.stl', size: 20, mtimeMs: 2 },
  ],
}

const scanFolder = vi.fn().mockResolvedValue(scanResult)
const openFolderDialog = vi.fn()
const setLastFolder = vi.fn()
const readFileBytes = vi.fn()

vi.mock('./ipc/api', () => ({
  api: {
    scanFolder: (...args: unknown[]) => scanFolder(...args),
    openFolderDialog: (...args: unknown[]) => openFolderDialog(...args),
    setLastFolder: (...args: unknown[]) => setLastFolder(...args),
    readFileBytes: (...args: unknown[]) => readFileBytes(...args),
  },
}))

const loadModel = vi.fn()
vi.mock('./lib/load-model', () => ({
  loadModel: (...args: unknown[]) => loadModel(...args),
}))

// App renders <Viewer/> in viewer mode, which constructs a real SceneManager
// (WebGL/three.js) -- unavailable in jsdom. Replace it with a no-op spy class
// so these App-level tests can exercise the mode/layout/keyboard wiring
// without touching a GL context.
class MockSceneManager {
  setModel = vi.fn()
  setMaterial = vi.fn()
  setLighting = vi.fn()
  setBackground = vi.fn()
  setGrid = vi.fn()
  setAutoRotate = vi.fn()
  resetCamera = vi.fn()
  resize = vi.fn()
  dispose = vi.fn()
  constructor(public canvas: HTMLCanvasElement) {}
}
vi.mock('./viewer/SceneManager', () => ({ SceneManager: MockSceneManager }))

// jsdom has neither ResizeObserver (used by Viewer) nor IntersectionObserver
// (used by ModelTile, which Filmstrip renders one per file).
class MockResizeObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  constructor(_cb: ResizeObserverCallback) {}
}
class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  takeRecords = vi.fn(() => [])
  root = null
  rootMargin = ''
  scrollMargin = ''
  thresholds: ReadonlyArray<number> = []
  constructor(_cb: IntersectionObserverCallback) {}
}

const { useUiStore } = await import('./state/store')
const { default: App } = await import('./App')

beforeEach(() => {
  scanFolder.mockClear()
  scanFolder.mockResolvedValue(scanResult)
  openFolderDialog.mockReset()
  setLastFolder.mockClear()
  readFileBytes.mockReset()
  readFileBytes.mockResolvedValue(new ArrayBuffer(8))
  loadModel.mockReset()
  loadModel.mockResolvedValue({
    positions: new Float32Array(9),
    stats: { triCount: 1, vertCount: 3, bbox: { x: 1, y: 1, z: 1 } },
  })
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
  useUiStore.setState(useUiStore.getInitialState())
})

describe('<App/>', () => {
  it('shows the empty state with an Open folder button when no folder is open', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /open folder/i })).toBeInTheDocument()
  })

  it('opens a folder via the dialog, scans it, records it as last folder, and renders tiles', async () => {
    openFolderDialog.mockResolvedValue('/root')
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /open folder/i }))

    expect(await screen.findByText('sub')).toBeTruthy()
    expect(await screen.findByText('a.stl')).toBeTruthy()
    expect(scanFolder).toHaveBeenCalledWith('/root')
    expect(setLastFolder).toHaveBeenCalledWith('/root')
  })

  it('does nothing if the folder dialog is cancelled', async () => {
    openFolderDialog.mockResolvedValue(null)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /open folder/i }))

    await Promise.resolve()
    expect(scanFolder).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /open folder/i })).toBeTruthy()
  })

  it('renders folder and model tiles once a folder is loaded', async () => {
    await useUiStore.getState().openFolder('/root')
    render(<App />)

    expect(screen.getByText('sub')).toBeTruthy()
    expect(screen.getByText('a.stl')).toBeTruthy()
  })

  it('clicking a model tile selects it by its index in the full scan.files array and switches to viewer mode', async () => {
    await useUiStore.getState().openFolder('/root')
    render(<App />)

    fireEvent.click(screen.getByText('a.stl'))

    const state = useUiStore.getState()
    expect(state.mode).toBe('viewer')
    expect(state.selectedIndex).toBe(0)

    // Let Viewer's async model-load effect (spawned by the mode switch)
    // settle before the test ends, so its state update isn't left dangling
    // outside of act().
    await waitFor(() => expect(readFileBytes).toHaveBeenCalled())
  })

  it('clicking a folder tile navigates into that folder', async () => {
    await useUiStore.getState().openFolder('/root')
    render(<App />)

    fireEvent.click(screen.getByText('sub'))

    expect(scanFolder).toHaveBeenLastCalledWith('/root/sub')
  })

  it('renders breadcrumb segments for the current folder that navigate on click', async () => {
    await useUiStore.getState().openFolder('/root')
    render(<App />)

    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument()
    const rootSegment = screen.getByRole('button', { name: 'root' })
    expect(rootSegment).toBeInTheDocument()

    fireEvent.click(rootSegment)
    expect(scanFolder).toHaveBeenLastCalledWith('/root')
  })

  it('clicking an ancestor breadcrumb segment (not the current folder) navigates to that ancestor', async () => {
    // Seed a deeper cwd so there are intermediate ancestor segments between
    // the drive root and the current folder to click on.
    scanFolder.mockResolvedValue(deepScanResult)
    await useUiStore.getState().openFolder('/root/sub/leaf')
    render(<App />)

    const subSegment = screen.getByRole('button', { name: 'sub' })
    expect(subSegment).toBeInTheDocument()

    fireEvent.click(subSegment)

    // Must be called with the clicked ancestor's cumulative path, not the
    // original (deeper) cwd or some other segment's path.
    expect(scanFolder).toHaveBeenLastCalledWith('/root/sub')
  })

  it('mode toggle switches between GridView and the viewer layout', async () => {
    await useUiStore.getState().openFolder('/root')
    const { container } = render(<App />)

    expect(container.querySelector('.grid-view')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reset camera/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Viewer' }))

    expect(container.querySelector('.grid-view')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /reset camera/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Grid' }))
    expect(container.querySelector('.grid-view')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reset camera/i })).not.toBeInTheDocument()
  })
})

describe('<App/> keyboard shortcuts', () => {
  it('ArrowRight/ArrowLeft change selectedIndex only in viewer mode', async () => {
    scanFolder.mockResolvedValue(twoFileScanResult)
    await useUiStore.getState().openFolder('/root')
    useUiStore.getState().select(0)
    render(<App />)
    await waitFor(() => expect(readFileBytes).toHaveBeenCalled())

    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(useUiStore.getState().selectedIndex).toBe(1)

    fireEvent.keyDown(document, { key: 'ArrowLeft' })
    expect(useUiStore.getState().selectedIndex).toBe(0)
  })

  it('ArrowRight is a no-op in grid mode', async () => {
    scanFolder.mockResolvedValue(twoFileScanResult)
    await useUiStore.getState().openFolder('/root')
    render(<App />)

    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(useUiStore.getState().selectedIndex).toBeNull()
  })

  it('Escape switches mode to grid only when in viewer mode', async () => {
    await useUiStore.getState().openFolder('/root')
    useUiStore.getState().select(0)
    render(<App />)
    await waitFor(() => expect(readFileBytes).toHaveBeenCalled())
    expect(useUiStore.getState().mode).toBe('viewer')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(useUiStore.getState().mode).toBe('grid')
  })

  it('f toggles showFilmstrip and i toggles showInfo', async () => {
    await useUiStore.getState().openFolder('/root')
    render(<App />)

    expect(useUiStore.getState().showFilmstrip).toBe(true)
    fireEvent.keyDown(document, { key: 'f' })
    expect(useUiStore.getState().showFilmstrip).toBe(false)

    expect(useUiStore.getState().showInfo).toBe(true)
    fireEvent.keyDown(document, { key: 'i' })
    expect(useUiStore.getState().showInfo).toBe(false)
  })

  it('does not trigger a shortcut when the keydown target is an input', async () => {
    await useUiStore.getState().openFolder('/root')
    useUiStore.getState().select(0)
    render(<App />)
    await waitFor(() => expect(readFileBytes).toHaveBeenCalled())

    const colorInput = screen.getByLabelText('Base color')
    fireEvent.keyDown(colorInput, { key: 'ArrowRight' })
    expect(useUiStore.getState().selectedIndex).toBe(0)

    fireEvent.keyDown(colorInput, { key: 'f' })
    expect(useUiStore.getState().showFilmstrip).toBe(true)
  })
})
