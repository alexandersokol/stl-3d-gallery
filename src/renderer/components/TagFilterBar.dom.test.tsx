// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { FileEntry, Metadata, ScanResult } from '../../shared/types'

// TagFilterBar only reads scan/metaByPath/activeTags and calls toggleTag --
// it never touches the api -- but store.ts imports it at module scope, so
// it still needs a mock.
vi.mock('../ipc/api', () => ({ api: {} }))

const { useUiStore } = await import('../state/store')
const { default: TagFilterBar } = await import('./TagFilterBar')

const meta = (tags: string[]): Metadata => ({ schemaVersion: 1, tags, notes: '', updatedAt: 't0' })

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState())
})

describe('<TagFilterBar/>', () => {
  it('renders nothing when no folder is open', () => {
    const { container } = render(<TagFilterBar />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the folder has no tagged files', () => {
    const file: FileEntry = { path: '/root/a.stl', name: 'a.stl', size: 1, mtimeMs: 1 }
    const scan: ScanResult = { folders: [], files: [file] }
    useUiStore.setState({ scan, metaByPath: {} })

    const { container } = render(<TagFilterBar />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one chip per unique tag across the folder, sorted', () => {
    const a: FileEntry = { path: '/root/a.stl', name: 'a.stl', size: 1, mtimeMs: 1 }
    const b: FileEntry = { path: '/root/b.stl', name: 'b.stl', size: 1, mtimeMs: 2 }
    const scan: ScanResult = { folders: [], files: [a, b] }
    useUiStore.setState({
      scan,
      metaByPath: { [a.path]: meta(['zebra']), [b.path]: meta(['apple', 'mango']) },
    })

    render(<TagFilterBar />)
    const chips = screen.getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual(['apple', 'mango', 'zebra'])
  })

  it('clicking a chip toggles it into activeTags and marks aria-pressed', () => {
    const a: FileEntry = { path: '/root/a.stl', name: 'a.stl', size: 1, mtimeMs: 1 }
    const scan: ScanResult = { folders: [], files: [a] }
    useUiStore.setState({ scan, metaByPath: { [a.path]: meta(['mechanical']) } })

    render(<TagFilterBar />)
    const chip = screen.getByRole('button', { name: 'mechanical' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(chip)
    expect(useUiStore.getState().activeTags).toEqual(['mechanical'])
    expect(chip).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(chip)
    expect(useUiStore.getState().activeTags).toEqual([])
    expect(chip).toHaveAttribute('aria-pressed', 'false')
  })
})
