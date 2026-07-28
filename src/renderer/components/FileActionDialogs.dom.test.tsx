// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const renameModel = vi.fn()
const copyModel = vi.fn()
const deleteModel = vi.fn()
vi.mock('../ipc/api', () => ({
  api: {
    renameModel: (...args: unknown[]) => renameModel(...args),
    copyModel: (...args: unknown[]) => copyModel(...args),
    deleteModel: (...args: unknown[]) => deleteModel(...args),
    scanFolder: vi.fn(),
    readMetadataBatch: vi.fn(),
  },
}))

const { useUiStore } = await import('../state/store')
const { default: FileActionDialogs } = await import('./FileActionDialogs')

const PATH = '/root/girl.stl'

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState())
  renameModel.mockReset().mockResolvedValue({ path: '/root/dragon.stl' })
  copyModel.mockReset().mockResolvedValue({ path: '/root/girl copy.stl' })
  deleteModel.mockReset().mockResolvedValue(undefined)
})

describe('rename dialog', () => {
  it('pre-fills the current name and renames on confirm', async () => {
    useUiStore.setState({ fileAction: { kind: 'rename', path: PATH } })
    render(<FileActionDialogs />)

    const input = screen.getByLabelText('New name') as HTMLInputElement
    expect(input.value).toBe('girl.stl')

    fireEvent.change(input, { target: { value: 'dragon.stl' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    await waitFor(() => expect(renameModel).toHaveBeenCalledWith(PATH, 'dragon.stl'))
    // On success the store clears the action, closing the dialog.
    await waitFor(() => expect(useUiStore.getState().fileAction).toBeNull())
  })

  it('disables confirm for an invalid name and does not call the api', () => {
    useUiStore.setState({ fileAction: { kind: 'rename', path: PATH } })
    render(<FileActionDialogs />)

    fireEvent.change(screen.getByLabelText('New name'), { target: { value: 'no-extension' } })
    const confirm = screen.getByRole('button', { name: 'Rename' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.click(confirm)
    expect(renameModel).not.toHaveBeenCalled()
  })

  it('Cancel closes without renaming', () => {
    useUiStore.setState({ fileAction: { kind: 'rename', path: PATH } })
    render(<FileActionDialogs />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(renameModel).not.toHaveBeenCalled()
    expect(useUiStore.getState().fileAction).toBeNull()
  })
})

describe('copy dialog', () => {
  it('suggests a "copy" name and copies on confirm', async () => {
    useUiStore.setState({ fileAction: { kind: 'copy', path: PATH } })
    render(<FileActionDialogs />)

    const input = screen.getByLabelText('Copy name') as HTMLInputElement
    expect(input.value).toBe('girl copy.stl')

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(copyModel).toHaveBeenCalledWith(PATH, 'girl copy.stl'))
  })
})

describe('delete dialog', () => {
  it('confirms deletion to trash', async () => {
    useUiStore.setState({ fileAction: { kind: 'delete', path: PATH } })
    render(<FileActionDialogs />)

    expect(screen.getByText(/Move to Trash\?/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Move to Trash' }))
    await waitFor(() => expect(deleteModel).toHaveBeenCalledWith(PATH))
    await waitFor(() => expect(useUiStore.getState().fileAction).toBeNull())
  })
})

describe('error toast', () => {
  it('shows and dismisses a fileActionError', () => {
    useUiStore.setState({ fileActionError: 'Move failed.' })
    render(<FileActionDialogs />)
    expect(screen.getByRole('alert')).toHaveTextContent('Move failed.')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(useUiStore.getState().fileActionError).toBeNull()
  })
})
