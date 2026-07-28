// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const getLastFolder = vi.fn()
const setLastFolder = vi.fn()
const openFolderDialog = vi.fn()

vi.mock('../ipc/api', () => ({
  api: {
    getLastFolder: (...args: unknown[]) => getLastFolder(...args),
    setLastFolder: (...args: unknown[]) => setLastFolder(...args),
    openFolderDialog: (...args: unknown[]) => openFolderDialog(...args),
  },
}))

const { useUiStore } = await import('../state/store')
const { default: EmptyState } = await import('./EmptyState')

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState())
  getLastFolder.mockReset()
  setLastFolder.mockReset()
  openFolderDialog.mockReset()
})

describe('<EmptyState/>', () => {
  it('shows no reopen button when there is no last folder', async () => {
    getLastFolder.mockResolvedValue(null)

    render(<EmptyState />)

    expect(await screen.findByText('No folder open yet.')).toBeInTheDocument()
    await waitFor(() => expect(getLastFolder).toHaveBeenCalled())
    expect(screen.queryByText(/^Reopen /)).not.toBeInTheDocument()
  })

  it('shows a "Reopen <name>" button and opens it when clicked', async () => {
    getLastFolder.mockResolvedValue('/root/models')
    const openFolder = vi.fn().mockResolvedValue(undefined)
    useUiStore.setState({ openFolder })

    render(<EmptyState />)

    const reopenButton = await screen.findByRole('button', { name: 'Reopen models' })

    await userEvent.click(reopenButton)

    expect(openFolder).toHaveBeenCalledWith('/root/models')
    expect(setLastFolder).toHaveBeenCalledWith('/root/models')
  })

  it('does not crash when getLastFolder rejects', async () => {
    getLastFolder.mockRejectedValue(new Error('boom'))

    render(<EmptyState />)

    expect(await screen.findByText('No folder open yet.')).toBeInTheDocument()
    await waitFor(() => expect(getLastFolder).toHaveBeenCalled())
    expect(screen.queryByText(/^Reopen /)).not.toBeInTheDocument()
  })
})
