// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { useUiStore } = await import('../state/store')
const { default: ViewerToolbar } = await import('./ViewerToolbar')

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState())
})

describe('<ViewerToolbar/>', () => {
  it('clicking a material preset button calls setMaterial and marks it active', () => {
    render(<ViewerToolbar />)

    expect(screen.getByRole('button', { name: 'clay' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'metal' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'metal' }))

    expect(useUiStore.getState().material).toBe('metal')
    expect(screen.getByRole('button', { name: 'metal' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'clay' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('changing the base color input calls setBaseColor', () => {
    render(<ViewerToolbar />)

    const colorInput = screen.getByLabelText('Base color')
    fireEvent.change(colorInput, { target: { value: '#ff0000' } })

    expect(useUiStore.getState().baseColor).toBe('#ff0000')
  })

  it('clicking a lighting preset button calls setLighting and marks it active', () => {
    render(<ViewerToolbar />)

    expect(screen.getByRole('button', { name: 'studio' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'dramatic' }))

    expect(useUiStore.getState().lighting).toBe('dramatic')
    expect(screen.getByRole('button', { name: 'dramatic' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'studio' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('changing the intensity range calls setLightIntensity', () => {
    render(<ViewerToolbar />)

    const range = screen.getByLabelText('Light intensity')
    fireEvent.change(range, { target: { value: '2.5' } })

    expect(useUiStore.getState().lightIntensity).toBe(2.5)
  })

  it('toggles background, grid, and auto-rotate', () => {
    render(<ViewerToolbar />)

    fireEvent.click(screen.getByRole('button', { name: /background: dark/i }))
    expect(useUiStore.getState().background).toBe('light')

    fireEvent.click(screen.getByRole('button', { name: 'Show grid' }))
    expect(useUiStore.getState().showGrid).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Auto-rotate' }))
    expect(useUiStore.getState().autoRotate).toBe(true)
  })

  it('reset camera button increments resetCameraSignal', () => {
    render(<ViewerToolbar />)

    expect(useUiStore.getState().resetCameraSignal).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: /reset camera/i }))
    expect(useUiStore.getState().resetCameraSignal).toBe(1)
  })

  it('prev/next buttons change selectedIndex', () => {
    useUiStore.setState({
      scan: {
        folders: [],
        files: [
          { path: '/a.stl', name: 'a.stl', size: 1, mtimeMs: 1 },
          { path: '/b.stl', name: 'b.stl', size: 1, mtimeMs: 2 },
        ],
      },
      selectedIndex: 0,
    })
    render(<ViewerToolbar />)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(useUiStore.getState().selectedIndex).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'Prev' }))
    expect(useUiStore.getState().selectedIndex).toBe(0)
  })
})
