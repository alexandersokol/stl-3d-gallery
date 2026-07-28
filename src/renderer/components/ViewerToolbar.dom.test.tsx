// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

const { useUiStore } = await import('../state/store')
const { default: ViewerToolbar } = await import('./ViewerToolbar')

beforeEach(() => {
  useUiStore.setState(useUiStore.getInitialState())
})

describe('<ViewerToolbar/>', () => {
  it('clicking a material preset button calls setMaterial and marks it active', () => {
    render(<ViewerToolbar />)

    // 'studio' (label "Studio") is the 3D-preview default material.
    expect(screen.getByRole('button', { name: 'Studio' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Metal' })).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'Metal' }))

    expect(useUiStore.getState().material).toBe('metal')
    expect(screen.getByRole('button', { name: 'Metal' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Studio' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('renders the material presets in two groups split by a separator', () => {
    render(<ViewerToolbar />)

    const materialGroup = within(screen.getByRole('group', { name: 'Material' }))
    // Primary presets are present with friendly labels...
    expect(materialGroup.getByRole('button', { name: 'Solid View' })).toBeInTheDocument()
    expect(materialGroup.getByRole('button', { name: 'Studio' })).toBeInTheDocument()
    // ...and a separator divides them from the secondary presets.
    expect(materialGroup.getByRole('separator')).toBeInTheDocument()
    expect(materialGroup.getByRole('button', { name: 'Ceramic' })).toBeInTheDocument()
  })

  it('changing the base color input calls setBaseColor', () => {
    render(<ViewerToolbar />)

    const colorInput = screen.getByLabelText('Base color')
    fireEvent.change(colorInput, { target: { value: '#ff0000' } })

    expect(useUiStore.getState().baseColor).toBe('#ff0000')
  })

  it('clicking a lighting preset button calls setLighting and marks it active', () => {
    render(<ViewerToolbar />)

    // Scope to the Lighting group: 'studio' is now BOTH a lighting preset and
    // a material preset (the studio-clay thumbnail matcap), so it appears as a
    // button in each group -- query within the right group to disambiguate.
    const lighting = within(screen.getByRole('group', { name: 'Lighting' }))

    expect(lighting.getByRole('button', { name: 'studio' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(lighting.getByRole('button', { name: 'dramatic' }))

    expect(useUiStore.getState().lighting).toBe('dramatic')
    expect(lighting.getByRole('button', { name: 'dramatic' })).toHaveAttribute('aria-pressed', 'true')
    expect(lighting.getByRole('button', { name: 'studio' })).toHaveAttribute('aria-pressed', 'false')
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
