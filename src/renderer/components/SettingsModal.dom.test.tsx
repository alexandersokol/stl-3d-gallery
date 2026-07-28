// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { useUiStore } = await import('../state/store')
const { default: SettingsModal } = await import('./SettingsModal')

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState())
})

describe('<SettingsModal/>', () => {
  it('renders nothing when settingsOpen is false', () => {
    render(<SettingsModal />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog when settingsOpen is true', () => {
    useUiStore.setState({ settingsOpen: true })
    render(<SettingsModal />)

    const dialog = screen.getByRole('dialog', { name: 'Settings' })
    expect(dialog).toBeInTheDocument()
  })

  it('clicking a camera-mode option calls setCameraMode', () => {
    useUiStore.setState({ settingsOpen: true })
    render(<SettingsModal />)

    expect(useUiStore.getState().cameraMode).toBe('fly')

    fireEvent.click(screen.getByRole('radio', { name: 'Zoom to surface' }))
    expect(useUiStore.getState().cameraMode).toBe('surface')

    fireEvent.click(screen.getByRole('radio', { name: 'Fly through / inside' }))
    expect(useUiStore.getState().cameraMode).toBe('fly')
  })

  it('changing the thumbnail preset selector calls setThumbnailPreset', () => {
    useUiStore.setState({ settingsOpen: true })
    render(<SettingsModal />)

    expect(useUiStore.getState().thumbnailPreset).toBe('studio')

    fireEvent.change(screen.getByLabelText('Thumbnail render preset'), { target: { value: 'metal' } })
    expect(useUiStore.getState().thumbnailPreset).toBe('metal')
  })

  it('closes on Escape', () => {
    useUiStore.setState({ settingsOpen: true })
    render(<SettingsModal />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useUiStore.getState().settingsOpen).toBe(false)
  })

  it('closes on backdrop click but not on modal content click', () => {
    useUiStore.setState({ settingsOpen: true })
    const { container } = render(<SettingsModal />)

    fireEvent.click(screen.getByRole('dialog'))
    expect(useUiStore.getState().settingsOpen).toBe(true)

    const overlay = container.querySelector('.settings-overlay')
    expect(overlay).not.toBeNull()
    fireEvent.click(overlay as Element)
    expect(useUiStore.getState().settingsOpen).toBe(false)
  })

  it('closes on clicking the close (X) button', () => {
    useUiStore.setState({ settingsOpen: true })
    render(<SettingsModal />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(useUiStore.getState().settingsOpen).toBe(false)
  })
})
