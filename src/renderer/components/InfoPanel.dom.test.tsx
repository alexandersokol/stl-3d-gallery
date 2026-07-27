// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { FileEntry, Metadata, ModelStats, ScanResult } from '../../shared/types'

const file: FileEntry = { path: '/root/a.stl', name: 'a.stl', size: 1_536_000, mtimeMs: 1 }
const secondFile: FileEntry = { path: '/root/b.stl', name: 'b.stl', size: 100, mtimeMs: 2 }
const scanResult: ScanResult = { folders: [], files: [file] }
const twoFileScan: ScanResult = { folders: [], files: [file, secondFile] }

const stats: ModelStats = { triCount: 1234, vertCount: 618, bbox: { x: 10, y: 20.5, z: 5 } }

const readMetadata = vi.fn()
const writeMetadata = vi.fn()
// ReferenceImage (rendered inside InfoPanel) reads the linked image for the
// selected file on mount. Not under test here (see
// ReferenceImage.dom.test.tsx) -- just stubbed so InfoPanel's own tests
// don't hit an undefined api method.
const readLinkedImage = vi.fn()
const writeLinkedImage = vi.fn()
const removeLinkedImage = vi.fn()
vi.mock('../ipc/api', () => ({
  api: {
    readMetadata: (...args: unknown[]) => readMetadata(...args),
    writeMetadata: (...args: unknown[]) => writeMetadata(...args),
    readLinkedImage: (...args: unknown[]) => readLinkedImage(...args),
    writeLinkedImage: (...args: unknown[]) => writeLinkedImage(...args),
    removeLinkedImage: (...args: unknown[]) => removeLinkedImage(...args),
  },
}))

const { useUiStore } = await import('../state/store')
const { default: InfoPanel } = await import('./InfoPanel')

const emptyMeta = (): Metadata => ({ schemaVersion: 1, tags: [], notes: '', updatedAt: 't0' })

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState())
  readMetadata.mockReset()
  readMetadata.mockResolvedValue(null)
  writeMetadata.mockReset()
  writeMetadata.mockResolvedValue(emptyMeta())
  readLinkedImage.mockReset()
  readLinkedImage.mockResolvedValue(null)
  writeLinkedImage.mockReset()
  removeLinkedImage.mockReset()
})

afterEach(() => {
  // Belt-and-suspenders: if a test forgot to switch back off fake timers
  // (e.g. it failed before reaching its `finally`), don't let that leak
  // into later test files.
  vi.useRealTimers()
})

describe('<InfoPanel/>', () => {
  it('shows a placeholder when nothing is selected', () => {
    render(<InfoPanel />)
    expect(screen.getByText('No model selected')).toBeInTheDocument()
  })

  it('renders identity + stats from the FileEntry and store currentStats', () => {
    useUiStore.setState({ scan: scanResult, selectedIndex: 0, currentStats: stats })
    render(<InfoPanel />)

    expect(screen.getByText('a.stl')).toBeInTheDocument()
    expect(screen.getByText('/root/a.stl')).toBeInTheDocument()
    // 1_536_000 bytes -> 1.5 MB
    expect(screen.getByText('1.5 MB')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument() // triCount
    expect(screen.getByText('618')).toBeInTheDocument() // vertCount
    expect(screen.getByText('10 × 20.5 × 5 mm')).toBeInTheDocument()
  })

  it('shows a loading placeholder for stat rows when currentStats is not loaded yet, but still shows identity', () => {
    useUiStore.setState({ scan: scanResult, selectedIndex: 0, currentStats: null })
    render(<InfoPanel />)

    expect(screen.getByText('a.stl')).toBeInTheDocument()
    // Triangles, Vertices, Dimensions rows all fall back to the em dash.
    expect(screen.getAllByText('—')).toHaveLength(3)
  })

  it('reads metadata for the selected file on mount, populates tags/notes, and caches it in the store', async () => {
    readMetadata.mockResolvedValue({ schemaVersion: 1, tags: ['mechanical'], notes: 'hello', updatedAt: 't1' })
    useUiStore.setState({ scan: scanResult, selectedIndex: 0 })
    render(<InfoPanel />)

    await waitFor(() => expect(readMetadata).toHaveBeenCalledWith('/root/a.stl'))
    await waitFor(() => expect(screen.getByLabelText('Notes')).toHaveValue('hello'))
    expect(screen.getByText('mechanical')).toBeInTheDocument()
    expect(useUiStore.getState().metaByPath['/root/a.stl']).toEqual({
      schemaVersion: 1,
      tags: ['mechanical'],
      notes: 'hello',
      updatedAt: 't1',
    })
  })

  it('defaults to empty tags/notes when readMetadata resolves null, and still caches the default', async () => {
    readMetadata.mockResolvedValue(null)
    useUiStore.setState({ scan: scanResult, selectedIndex: 0 })
    render(<InfoPanel />)

    await waitFor(() => expect(useUiStore.getState().metaByPath['/root/a.stl']).toBeDefined())
    expect(screen.getByLabelText('Notes')).toHaveValue('')
    expect(useUiStore.getState().metaByPath['/root/a.stl'].tags).toEqual([])
  })

  it('debounces notes edits: writeMetadata is not called immediately, only once after ~500ms with the merged payload', async () => {
    readMetadata.mockResolvedValue({ schemaVersion: 1, tags: ['x'], notes: 'hello', updatedAt: 't1' })
    useUiStore.setState({ scan: scanResult, selectedIndex: 0 })
    render(<InfoPanel />)
    await waitFor(() => expect(screen.getByLabelText('Notes')).toHaveValue('hello'))

    vi.useFakeTimers()
    try {
      const notes = screen.getByLabelText('Notes')
      fireEvent.change(notes, { target: { value: 'hello wo' } })
      expect(writeMetadata).not.toHaveBeenCalled()

      // Rapid subsequent keystrokes within the debounce window must reset
      // the timer rather than queuing additional writes.
      await vi.advanceTimersByTimeAsync(200)
      fireEvent.change(notes, { target: { value: 'hello world' } })
      expect(writeMetadata).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(499)
      expect(writeMetadata).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(1)
      expect(writeMetadata).toHaveBeenCalledTimes(1)
      expect(writeMetadata).toHaveBeenCalledWith('/root/a.stl', { tags: ['x'], notes: 'hello world' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('debounces tag edits the same way and merges the current notes into the write', async () => {
    readMetadata.mockResolvedValue({ schemaVersion: 1, tags: ['x'], notes: 'notes-here', updatedAt: 't1' })
    useUiStore.setState({ scan: scanResult, selectedIndex: 0 })
    render(<InfoPanel />)
    await waitFor(() => expect(screen.getByText('x')).toBeInTheDocument())

    vi.useFakeTimers()
    try {
      fireEvent.change(screen.getByLabelText('Add tag'), { target: { value: 'newtag' } })
      fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      expect(writeMetadata).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(500)
      expect(writeMetadata).toHaveBeenCalledTimes(1)
      expect(writeMetadata).toHaveBeenCalledWith('/root/a.stl', { tags: ['x', 'newtag'], notes: 'notes-here' })

      const written = { schemaVersion: 1 as const, tags: ['x', 'newtag'], notes: 'notes-here', updatedAt: 't2' }
      writeMetadata.mockResolvedValue(written)
    } finally {
      vi.useRealTimers()
    }
  })

  it('switching the selected file flushes a pending save to the OLD path only -- never a stale write to the new path', async () => {
    readMetadata.mockImplementation((path: string) =>
      Promise.resolve(
        path === file.path
          ? { schemaVersion: 1, tags: [], notes: 'a-notes', updatedAt: 't1' }
          : { schemaVersion: 1, tags: [], notes: 'b-notes', updatedAt: 't1' },
      ),
    )
    useUiStore.setState({ scan: twoFileScan, selectedIndex: 0 })
    render(<InfoPanel />)
    await waitFor(() => expect(screen.getByLabelText('Notes')).toHaveValue('a-notes'))

    vi.useFakeTimers()
    try {
      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'a-notes-edited' } })
      expect(writeMetadata).not.toHaveBeenCalled()

      // Switch selection before the debounce timer would have fired.
      act(() => {
        useUiStore.setState({ selectedIndex: 1 })
      })

      // The pending edit must be flushed immediately to the path it was
      // scheduled for (a.stl), not silently dropped and not misattributed
      // to the newly selected file (b.stl).
      expect(writeMetadata).toHaveBeenCalledTimes(1)
      expect(writeMetadata).toHaveBeenCalledWith(file.path, { tags: [], notes: 'a-notes-edited' })

      // Advancing time further must not produce a second (duplicate or
      // misrouted) write -- the timer was cleared, not left running.
      await vi.advanceTimersByTimeAsync(1000)
      expect(writeMetadata).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('flushes a pending save on unmount', async () => {
    readMetadata.mockResolvedValue({ schemaVersion: 1, tags: [], notes: 'orig', updatedAt: 't1' })
    useUiStore.setState({ scan: scanResult, selectedIndex: 0 })
    const { unmount } = render(<InfoPanel />)
    await waitFor(() => expect(screen.getByLabelText('Notes')).toHaveValue('orig'))

    vi.useFakeTimers()
    try {
      fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'orig-edited' } })
      expect(writeMetadata).not.toHaveBeenCalled()

      act(() => {
        unmount()
      })

      expect(writeMetadata).toHaveBeenCalledTimes(1)
      expect(writeMetadata).toHaveBeenCalledWith(file.path, { tags: [], notes: 'orig-edited' })
    } finally {
      vi.useRealTimers()
    }
  })
})
