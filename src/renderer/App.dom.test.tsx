// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { Metadata, ScanResult } from '../shared/types'

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

// Fixtures for the search/tag filtering tests (Task 5.2b): three files
// whose tags overlap enough to exercise AND semantics (Bunny + Vase both
// have 'animal'; only Bunny also has 'cute').
const taggedScanResult: ScanResult = {
  folders: [],
  files: [
    { name: 'Bunny.stl', path: '/root/Bunny.stl', size: 10, mtimeMs: 1 },
    { name: 'gear.stl', path: '/root/gear.stl', size: 20, mtimeMs: 2 },
    { name: 'Vase.stl', path: '/root/Vase.stl', size: 30, mtimeMs: 3 },
  ],
}

const taggedMeta: Record<string, Metadata> = {
  '/root/Bunny.stl': { schemaVersion: 1, tags: ['animal', 'cute'], notes: '', updatedAt: 't0' },
  '/root/gear.stl': { schemaVersion: 1, tags: ['mechanical'], notes: '', updatedAt: 't0' },
  '/root/Vase.stl': { schemaVersion: 1, tags: ['animal', 'home'], notes: '', updatedAt: 't0' },
}

const scanFolder = vi.fn().mockResolvedValue(scanResult)
const openFolderDialog = vi.fn()
const setLastFolder = vi.fn()
const getLastFolder = vi.fn().mockResolvedValue(null)
const readFileBytes = vi.fn()
// InfoPanel reads/writes metadata for the selected file. Not under test
// here (see InfoPanel.dom.test.tsx) -- just stubbed so App-level tests that
// select a file don't hit an undefined api method.
const readMetadata = vi.fn()
const writeMetadata = vi.fn()
// openFolder batch-loads metadata (Task 5.2b) for the whole folder.
const readMetadataBatch = vi.fn()
// ReferenceImage (rendered inside InfoPanel) reads the linked image for the
// selected file. Not under test here (see ReferenceImage.dom.test.tsx) --
// just stubbed so App-level tests that select a file don't hit an undefined
// api method.
const readLinkedImage = vi.fn()
const writeLinkedImage = vi.fn()
const removeLinkedImage = vi.fn()
// onOpenFile (Task 7.1) has no unsubscribe -- it just registers a callback.
// Capture it here so tests can invoke it directly to simulate the main
// process forwarding an 'open-file' path.
let openFileCallback: ((path: string) => void) | null = null
const onOpenFile = vi.fn((cb: (path: string) => void) => {
  openFileCallback = cb
})

vi.mock('./ipc/api', () => ({
  api: {
    scanFolder: (...args: unknown[]) => scanFolder(...args),
    openFolderDialog: (...args: unknown[]) => openFolderDialog(...args),
    setLastFolder: (...args: unknown[]) => setLastFolder(...args),
    getLastFolder: (...args: unknown[]) => getLastFolder(...args),
    readFileBytes: (...args: unknown[]) => readFileBytes(...args),
    readMetadata: (...args: unknown[]) => readMetadata(...args),
    writeMetadata: (...args: unknown[]) => writeMetadata(...args),
    readMetadataBatch: (...args: unknown[]) => readMetadataBatch(...args),
    readLinkedImage: (...args: unknown[]) => readLinkedImage(...args),
    writeLinkedImage: (...args: unknown[]) => writeLinkedImage(...args),
    removeLinkedImage: (...args: unknown[]) => removeLinkedImage(...args),
    onOpenFile: (...args: [(path: string) => void]) => onOpenFile(...args),
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
  getLastFolder.mockReset()
  getLastFolder.mockResolvedValue(null)
  readFileBytes.mockReset()
  readFileBytes.mockResolvedValue(new ArrayBuffer(8))
  readMetadata.mockReset()
  readMetadata.mockResolvedValue(null)
  writeMetadata.mockReset()
  writeMetadata.mockResolvedValue({ schemaVersion: 1, tags: [], notes: '', updatedAt: '2024-01-01T00:00:00.000Z' })
  readMetadataBatch.mockReset()
  readMetadataBatch.mockResolvedValue({})
  readLinkedImage.mockReset()
  readLinkedImage.mockResolvedValue(null)
  writeLinkedImage.mockReset()
  removeLinkedImage.mockReset()
  onOpenFile.mockClear()
  openFileCallback = null
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

describe('<App/> search + tag filtering (Task 5.2b)', () => {
  it('batch-loads metadata on openFolder and surfaces its tags in the tag filter bar', async () => {
    scanFolder.mockResolvedValue(taggedScanResult)
    readMetadataBatch.mockResolvedValue(taggedMeta)

    await useUiStore.getState().openFolder('/root')
    render(<App />)

    expect(readMetadataBatch).toHaveBeenCalledWith([
      '/root/Bunny.stl',
      '/root/gear.stl',
      '/root/Vase.stl',
    ])
    expect(useUiStore.getState().metaByPath).toEqual(taggedMeta)

    // One chip per unique tag across the folder, sorted.
    const chipBar = screen.getByRole('group', { name: /filter by tag/i })
    const chips = within(chipBar).getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual(['animal', 'cute', 'home', 'mechanical'])
  })

  it('search box and tag filter bar only render in grid mode', async () => {
    scanFolder.mockResolvedValue(taggedScanResult)
    readMetadataBatch.mockResolvedValue(taggedMeta)
    await useUiStore.getState().openFolder('/root')
    render(<App />)

    expect(screen.getByPlaceholderText('Search by name…')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /filter by tag/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Viewer' }))

    expect(screen.queryByPlaceholderText('Search by name…')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /filter by tag/i })).not.toBeInTheDocument()
  })

  it('typing in the search box narrows the grid by filename substring, case-insensitively', async () => {
    scanFolder.mockResolvedValue(taggedScanResult)
    readMetadataBatch.mockResolvedValue(taggedMeta)
    await useUiStore.getState().openFolder('/root')
    render(<App />)

    expect(screen.getByText('Bunny.stl')).toBeInTheDocument()
    expect(screen.getByText('gear.stl')).toBeInTheDocument()
    expect(screen.getByText('Vase.stl')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search by name…'), { target: { value: 'VAS' } })

    expect(screen.queryByText('Bunny.stl')).not.toBeInTheDocument()
    expect(screen.queryByText('gear.stl')).not.toBeInTheDocument()
    expect(screen.getByText('Vase.stl')).toBeInTheDocument()
  })

  it('tag chips narrow the grid with AND semantics, and deselecting a tag restores it', async () => {
    scanFolder.mockResolvedValue(taggedScanResult)
    readMetadataBatch.mockResolvedValue(taggedMeta)
    await useUiStore.getState().openFolder('/root')
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'animal' }))
    // Only Bunny and Vase carry 'animal'.
    expect(screen.getByText('Bunny.stl')).toBeInTheDocument()
    expect(screen.getByText('Vase.stl')).toBeInTheDocument()
    expect(screen.queryByText('gear.stl')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'cute' }))
    // AND semantics: only Bunny has both 'animal' and 'cute'.
    expect(screen.getByText('Bunny.stl')).toBeInTheDocument()
    expect(screen.queryByText('Vase.stl')).not.toBeInTheDocument()
    expect(screen.queryByText('gear.stl')).not.toBeInTheDocument()

    // Deselecting 'cute' falls back to the single-tag ('animal') filter.
    fireEvent.click(screen.getByRole('button', { name: 'cute' }))
    expect(screen.getByText('Bunny.stl')).toBeInTheDocument()
    expect(screen.getByText('Vase.stl')).toBeInTheDocument()
    expect(screen.queryByText('gear.stl')).not.toBeInTheDocument()

    // Deselecting 'animal' restores the full, unfiltered grid.
    fireEvent.click(screen.getByRole('button', { name: 'animal' }))
    expect(screen.getByText('Bunny.stl')).toBeInTheDocument()
    expect(screen.getByText('gear.stl')).toBeInTheDocument()
    expect(screen.getByText('Vase.stl')).toBeInTheDocument()
  })
})

describe('<App/> single-file open (Task 7.1)', () => {
  it('subscribes to onOpenFile exactly once per mount', () => {
    render(<App />)
    expect(onOpenFile).toHaveBeenCalledTimes(1)
  })

  it('opening a single file opens its parent folder and selects it in the viewer', async () => {
    scanFolder.mockResolvedValue(twoFileScanResult)
    render(<App />)
    expect(openFileCallback).not.toBeNull()

    openFileCallback!('/root/b.stl')

    await waitFor(() => expect(scanFolder).toHaveBeenCalledWith('/root'))
    await waitFor(() => {
      const state = useUiStore.getState()
      expect(state.mode).toBe('viewer')
      expect(state.selectedIndex).toBe(1)
    })

    // Let Viewer's async model-load effect settle before the test ends.
    await waitFor(() => expect(readFileBytes).toHaveBeenCalled())
  })

  it('opening a file not present in its own folder scan leaves the app in grid mode', async () => {
    scanFolder.mockResolvedValue(scanResult) // only contains /root/a.stl
    render(<App />)
    expect(openFileCallback).not.toBeNull()

    openFileCallback!('/root/missing.stl')

    await waitFor(() => expect(scanFolder).toHaveBeenCalledWith('/root'))
    // Give any (absent) selection microtask a turn, then assert we stayed put.
    await waitFor(() => expect(useUiStore.getState().cwd).toBe('/root'))
    expect(useUiStore.getState().mode).toBe('grid')
    expect(useUiStore.getState().selectedIndex).toBeNull()
  })
})
