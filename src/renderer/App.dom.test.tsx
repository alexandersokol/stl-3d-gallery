// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ScanResult } from '../shared/types'

const scanResult: ScanResult = {
  folders: [{ name: 'sub', path: '/root/sub' }],
  files: [{ name: 'a.stl', path: '/root/a.stl', size: 10, mtimeMs: 1 }],
}

const scanFolder = vi.fn().mockResolvedValue(scanResult)
const openFolderDialog = vi.fn()
const setLastFolder = vi.fn()

vi.mock('./ipc/api', () => ({
  api: {
    scanFolder: (...args: unknown[]) => scanFolder(...args),
    openFolderDialog: (...args: unknown[]) => openFolderDialog(...args),
    setLastFolder: (...args: unknown[]) => setLastFolder(...args),
  },
}))

const { useUiStore } = await import('./state/store')
const { default: App } = await import('./App')

beforeEach(() => {
  scanFolder.mockClear()
  scanFolder.mockResolvedValue(scanResult)
  openFolderDialog.mockReset()
  setLastFolder.mockClear()
  useUiStore.setState(useUiStore.getInitialState())
})

afterEach(() => {
  cleanup()
})

describe('<App/>', () => {
  it('shows the empty state with an Open folder button when no folder is open', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: /open folder/i })).toBeTruthy()
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

    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeTruthy()
    const rootSegment = screen.getByRole('button', { name: 'root' })
    expect(rootSegment).toBeTruthy()

    fireEvent.click(rootSegment)
    expect(scanFolder).toHaveBeenLastCalledWith('/root')
  })
})
