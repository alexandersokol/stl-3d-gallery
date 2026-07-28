// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const moveModel = vi.fn()
vi.mock('../ipc/api', () => ({
  api: {
    moveModel: (...args: unknown[]) => moveModel(...args),
    scanFolder: vi.fn(),
    readMetadataBatch: vi.fn(),
  },
}))

const { useUiStore } = await import('../state/store')
const { default: FileActionsMenu } = await import('./FileActionsMenu')

const PATH = '/root/a.stl'

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState())
  moveModel.mockReset().mockResolvedValue(null)
})

describe('<FileActionsMenu/>', () => {
  it('is closed initially and opens on click', () => {
    render(<FileActionsMenu path={PATH} />)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'File actions' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    for (const name of ['Rename', 'Copy', 'Move', 'Delete']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument()
    }
  })

  it('Rename dispatches a rename file-action for this path', () => {
    render(<FileActionsMenu path={PATH} />)
    fireEvent.click(screen.getByRole('button', { name: 'File actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(useUiStore.getState().fileAction).toEqual({ kind: 'rename', path: PATH })
    // Menu closes after choosing an item.
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Delete dispatches a delete file-action for this path', () => {
    render(<FileActionsMenu path={PATH} />)
    fireEvent.click(screen.getByRole('button', { name: 'File actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(useUiStore.getState().fileAction).toEqual({ kind: 'delete', path: PATH })
  })

  it('Move calls the native-picker move flow (no dialog)', () => {
    render(<FileActionsMenu path={PATH} />)
    fireEvent.click(screen.getByRole('button', { name: 'File actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move' }))
    expect(moveModel).toHaveBeenCalledWith(PATH)
    // Move uses the native folder picker, not the fileAction dialog state.
    expect(useUiStore.getState().fileAction).toBeNull()
  })
})
