// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

// SearchBox only reads/writes store.search -- it never touches the api --
// but store.ts imports it at module scope, so it still needs a mock.
vi.mock('../ipc/api', () => ({ api: {} }))

const { useUiStore } = await import('../state/store')
const { default: SearchBox } = await import('./SearchBox')

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState())
})

describe('<SearchBox/>', () => {
  it('renders empty and bound to store.search', () => {
    render(<SearchBox />)
    expect(screen.getByPlaceholderText('Search by name…')).toHaveValue('')
  })

  it('typing updates store.search', () => {
    render(<SearchBox />)
    fireEvent.change(screen.getByPlaceholderText('Search by name…'), { target: { value: 'bunny' } })

    expect(useUiStore.getState().search).toBe('bunny')
    expect(screen.getByPlaceholderText('Search by name…')).toHaveValue('bunny')
  })

  it('reflects external updates to store.search', () => {
    render(<SearchBox />)
    act(() => useUiStore.getState().setSearch('gear'))

    expect(screen.getByPlaceholderText('Search by name…')).toHaveValue('gear')
  })
})
