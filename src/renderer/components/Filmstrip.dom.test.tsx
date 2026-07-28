// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ScanResult } from '../../shared/types'

vi.mock('../ipc/api', () => ({
  api: {
    readThumbnail: vi.fn().mockResolvedValue(null),
    readFileBytes: vi.fn(),
    writeThumbnail: vi.fn(),
  },
}))
vi.mock('../lib/load-model', () => ({ loadModel: vi.fn() }))
vi.mock('../viewer/thumbnailer', () => ({ renderThumbnail: vi.fn() }))

// jsdom has no IntersectionObserver; ModelTile (rendered per filmstrip
// entry) constructs one on mount. A harmless no-op stub is enough here --
// these tests only assert Filmstrip's structure/highlighting, not the
// thumbnail-loading flow (covered by ModelTile.dom.test.tsx).
class NoopIntersectionObserver {
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

const scanResult: ScanResult = {
  folders: [],
  files: [
    { path: '/root/a.stl', name: 'a.stl', size: 1, mtimeMs: 1 },
    { path: '/root/b.stl', name: 'b.stl', size: 1, mtimeMs: 2 },
    { path: '/root/c.stl', name: 'c.stl', size: 1, mtimeMs: 3 },
  ],
}

const { useUiStore } = await import('../state/store')
const { default: Filmstrip } = await import('./Filmstrip')

beforeEach(() => {
  globalThis.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver
  useUiStore.setState(useUiStore.getInitialState())
})

describe('<Filmstrip/>', () => {
  it('renders nothing when there is no scan', () => {
    const { container } = render(<Filmstrip />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a tile per scan.files entry', () => {
    useUiStore.setState({ scan: scanResult, selectedIndex: 1 })
    render(<Filmstrip />)

    expect(screen.getByText('a.stl')).toBeInTheDocument()
    expect(screen.getByText('b.stl')).toBeInTheDocument()
    expect(screen.getByText('c.stl')).toBeInTheDocument()
  })

  it('highlights the tile at selectedIndex', () => {
    useUiStore.setState({ scan: scanResult, selectedIndex: 1 })
    render(<Filmstrip />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).not.toHaveClass('filmstrip-item-active')
    expect(items[1]).toHaveClass('filmstrip-item-active')
    expect(items[2]).not.toHaveClass('filmstrip-item-active')
  })

  it('clicking a tile selects it by its scan index', () => {
    useUiStore.setState({ scan: scanResult, selectedIndex: 0 })
    render(<Filmstrip />)

    fireEvent.click(screen.getByText('c.stl').closest('button')!)

    expect(useUiStore.getState().selectedIndex).toBe(2)
  })
})
