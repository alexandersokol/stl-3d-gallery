// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const openInBlender = vi.fn()
vi.mock('../ipc/api', () => ({ api: { openInBlender: (...a: unknown[]) => openInBlender(...a) } }))

const { useUiStore } = await import('./store')

beforeEach(() => {
  localStorage.clear()
  openInBlender.mockReset().mockResolvedValue(undefined)
  useUiStore.setState(useUiStore.getInitialState())
})

describe('openInBlender', () => {
  it('asks main to open the model with auto-detection when no path is configured', async () => {
    await useUiStore.getState().openInBlender('/x/a.stl')
    expect(openInBlender).toHaveBeenCalledWith('/x/a.stl', null)
    expect(useUiStore.getState().fileActionError).toBeNull()
  })

  it('passes the configured Blender path through', async () => {
    useUiStore.getState().setBlenderPath('/opt/blender/blender')
    await useUiStore.getState().openInBlender('/x/a.stl')
    expect(openInBlender).toHaveBeenCalledWith('/x/a.stl', '/opt/blender/blender')
  })

  it('surfaces a launch failure as the file-action error toast', async () => {
    openInBlender.mockRejectedValue(new Error('Blender was not found.'))
    await useUiStore.getState().openInBlender('/x/a.stl')
    expect(useUiStore.getState().fileActionError).toBe('Blender was not found.')
  })
})

describe('blenderPath', () => {
  it('defaults to empty (auto-detect)', () => {
    expect(useUiStore.getState().blenderPath).toBe('')
  })

  it('persists to localStorage', () => {
    useUiStore.getState().setBlenderPath('/opt/b')
    expect(localStorage.getItem('stl-gallery:blenderPath')).toBe('/opt/b')
  })
})
