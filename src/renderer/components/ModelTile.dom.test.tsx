// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import type { FileEntry } from '../../shared/types'

const file: FileEntry = { path: '/root/a.stl', name: 'a.stl', size: 100, mtimeMs: 1 }

const readThumbnail = vi.fn()
const readFileBytes = vi.fn()
const writeThumbnail = vi.fn()
const loadModel = vi.fn()
const renderThumbnail = vi.fn()

vi.mock('../ipc/api', () => ({
  api: {
    readThumbnail: (...args: unknown[]) => readThumbnail(...args),
    readFileBytes: (...args: unknown[]) => readFileBytes(...args),
    writeThumbnail: (...args: unknown[]) => writeThumbnail(...args),
  },
}))

vi.mock('../lib/load-model', () => ({
  loadModel: (...args: unknown[]) => loadModel(...args),
}))

vi.mock('../viewer/thumbnailer', () => ({
  renderThumbnail: (...args: unknown[]) => renderThumbnail(...args),
}))

// jsdom has no IntersectionObserver at all. This mock captures the
// constructor callback per-instance so tests can fire a synthetic
// intersection entry ("the tile scrolled into view") on demand.
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = []
  callback: IntersectionObserverCallback
  elements: Element[] = []
  disconnect = vi.fn()

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  observe(el: Element) {
    this.elements.push(el)
  }

  unobserve(el: Element) {
    this.elements = this.elements.filter((e) => e !== el)
  }

  trigger(isIntersecting: boolean) {
    const entries = this.elements.map(
      (target) => ({ isIntersecting, target }) as IntersectionObserverEntry,
    )
    this.callback(entries, this as unknown as IntersectionObserver)
  }
}

const { default: ModelTile } = await import('./ModelTile')

function fakePngBlob(): Blob {
  return { arrayBuffer: async () => new ArrayBuffer(4) } as unknown as Blob
}

beforeEach(() => {
  MockIntersectionObserver.instances = []
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

  readThumbnail.mockReset()
  readFileBytes.mockReset()
  writeThumbnail.mockReset()
  loadModel.mockReset()
  renderThumbnail.mockReset()

  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
})

describe('<ModelTile/> thumbnails', () => {
  it('cache hit: shows an <img> from the cached PNG without regenerating', async () => {
    readThumbnail.mockResolvedValue(new ArrayBuffer(8))

    render(<ModelTile file={file} />)
    expect(MockIntersectionObserver.instances).toHaveLength(1)

    act(() => {
      MockIntersectionObserver.instances[0].trigger(true)
    })

    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'blob:mock-url')

    expect(readThumbnail).toHaveBeenCalledWith(file.path, 'studio')
    expect(readFileBytes).not.toHaveBeenCalled()
    expect(loadModel).not.toHaveBeenCalled()
    expect(renderThumbnail).not.toHaveBeenCalled()
    expect(writeThumbnail).not.toHaveBeenCalled()
  })

  it('cache miss: reads bytes, parses, renders, persists, then shows the result', async () => {
    readThumbnail.mockResolvedValue(null)
    readFileBytes.mockResolvedValue(new ArrayBuffer(4))
    loadModel.mockResolvedValue({
      positions: new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]),
      stats: { triCount: 1, vertCount: 3, bbox: { x: 1, y: 1, z: 1 } },
    })
    const blob = fakePngBlob()
    renderThumbnail.mockResolvedValue(blob)
    writeThumbnail.mockResolvedValue(undefined)

    render(<ModelTile file={file} />)
    act(() => {
      MockIntersectionObserver.instances[0].trigger(true)
    })

    await screen.findByRole('img')

    expect(readFileBytes).toHaveBeenCalledTimes(1)
    expect(readFileBytes).toHaveBeenCalledWith(file.path)
    expect(loadModel).toHaveBeenCalledTimes(1)
    expect(renderThumbnail).toHaveBeenCalledTimes(1)
    expect(renderThumbnail).toHaveBeenCalledWith(expect.any(Float32Array), 'studio')
    expect(writeThumbnail).toHaveBeenCalledTimes(1)
    expect(writeThumbnail).toHaveBeenCalledWith(file.path, 'studio', expect.any(ArrayBuffer))

    // Occurred in the documented pipeline order: read -> parse -> render -> persist.
    const order = [readFileBytes, loadModel, renderThumbnail, writeThumbnail].map(
      (fn) => fn.mock.invocationCallOrder[0],
    )
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('does not touch the api until the tile actually intersects', async () => {
    readThumbnail.mockResolvedValue(new ArrayBuffer(8))

    render(<ModelTile file={file} />)

    // Give any (incorrect) eager effect a chance to fire before asserting.
    await act(async () => {
      await Promise.resolve()
    })

    expect(readThumbnail).not.toHaveBeenCalled()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('🧊')).toBeInTheDocument()
  })

  it('error path: falls back to the placeholder instead of throwing when generation fails', async () => {
    readThumbnail.mockResolvedValue(null)
    readFileBytes.mockRejectedValue(new Error('disk read failed'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ModelTile file={file} />)

    expect(() => {
      act(() => {
        MockIntersectionObserver.instances[0].trigger(true)
      })
    }).not.toThrow()

    await waitFor(() => {
      expect(readFileBytes).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('🧊')).toBeInTheDocument()
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })

  it('disconnects the IntersectionObserver on unmount', () => {
    readThumbnail.mockResolvedValue(null)
    const { unmount } = render(<ModelTile file={file} />)
    const instance = MockIntersectionObserver.instances[0]

    unmount()

    expect(instance.disconnect).toHaveBeenCalledTimes(1)
  })
})
