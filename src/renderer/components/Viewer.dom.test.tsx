// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import type { FileEntry, ModelStats, ScanResult } from '../../shared/types'
import { DEFAULT_BASE_COLOR } from '../viewer/materials'

const file: FileEntry = { path: '/root/a.stl', name: 'a.stl', size: 100, mtimeMs: 1 }
const scanResult: ScanResult = { folders: [], files: [file] }

const readFileBytes = vi.fn()
vi.mock('../ipc/api', () => ({
  api: { readFileBytes: (...args: unknown[]) => readFileBytes(...args) },
}))

const loadModel = vi.fn()
vi.mock('../lib/load-model', () => ({
  loadModel: (...args: unknown[]) => loadModel(...args),
}))

// SceneManager owns real WebGL/three.js resources that don't exist in
// jsdom. Replace it with a plain spy class so Viewer's wiring (construct,
// dispose, and each store-setting -> method call) can be asserted without
// ever touching a real GL context.
class MockSceneManager {
  static instances: MockSceneManager[] = []
  setModel = vi.fn()
  setMaterial = vi.fn()
  setLighting = vi.fn()
  setBackground = vi.fn()
  setCameraMode = vi.fn()
  setGrid = vi.fn()
  setAutoRotate = vi.fn()
  resetCamera = vi.fn()
  resize = vi.fn()
  dispose = vi.fn()
  constructor(public canvas: HTMLCanvasElement) {
    MockSceneManager.instances.push(this)
  }
}
vi.mock('../viewer/SceneManager', () => ({ SceneManager: MockSceneManager }))

// jsdom has no ResizeObserver at all.
class MockResizeObserver {
  static instances: MockResizeObserver[] = []
  callback: ResizeObserverCallback
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb
    MockResizeObserver.instances.push(this)
  }
}

const { useUiStore } = await import('../state/store')
const { default: Viewer } = await import('./Viewer')

const stats: ModelStats = { triCount: 1, vertCount: 3, bbox: { x: 1, y: 1, z: 1 } }

beforeEach(() => {
  MockSceneManager.instances = []
  MockResizeObserver.instances = []
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

  readFileBytes.mockReset()
  loadModel.mockReset()
  readFileBytes.mockResolvedValue(new ArrayBuffer(8))
  loadModel.mockResolvedValue({ positions: new Float32Array(9), stats })

  useUiStore.setState(useUiStore.getInitialState())
  useUiStore.setState({ scan: scanResult, selectedIndex: 0 })
})

describe('<Viewer/>', () => {
  it('constructs a SceneManager on mount and loads the selected model', async () => {
    render(<Viewer />)

    expect(MockSceneManager.instances).toHaveLength(1)
    const sm = MockSceneManager.instances[0]

    await waitFor(() => expect(sm.setModel).toHaveBeenCalledTimes(1))
    expect(readFileBytes).toHaveBeenCalledWith(file.path)
    expect(loadModel).toHaveBeenCalledTimes(1)
    expect(useUiStore.getState().currentStats).toEqual(stats)
  })

  it('applies the current store settings once, right after creating the SceneManager', async () => {
    render(<Viewer />)
    const sm = MockSceneManager.instances[0]
    await waitFor(() => expect(sm.setModel).toHaveBeenCalled())

    expect(sm.setMaterial).toHaveBeenCalledWith('studio', DEFAULT_BASE_COLOR)
    expect(sm.setLighting).toHaveBeenCalledWith('studio', 1)
    expect(sm.setBackground).toHaveBeenCalledWith('dark')
    expect(sm.setCameraMode).toHaveBeenCalledWith('fly')
    expect(sm.setGrid).toHaveBeenCalledWith(false)
    expect(sm.setAutoRotate).toHaveBeenCalledWith(false)
  })

  it('calls setCameraMode when cameraMode changes in the store', async () => {
    render(<Viewer />)
    const sm = MockSceneManager.instances[0]
    await waitFor(() => expect(sm.setModel).toHaveBeenCalled())
    sm.setCameraMode.mockClear()

    act(() => {
      useUiStore.getState().setCameraMode('surface')
    })
    await waitFor(() => expect(sm.setCameraMode).toHaveBeenCalledWith('surface'))

    act(() => {
      useUiStore.getState().setCameraMode('fly')
    })
    await waitFor(() => expect(sm.setCameraMode).toHaveBeenCalledWith('fly'))
  })

  it('calls setMaterial when material or baseColor change in the store', async () => {
    render(<Viewer />)
    const sm = MockSceneManager.instances[0]
    await waitFor(() => expect(sm.setModel).toHaveBeenCalled())
    sm.setMaterial.mockClear()

    act(() => {
      useUiStore.getState().setMaterial('metal')
    })
    await waitFor(() => expect(sm.setMaterial).toHaveBeenCalledWith('metal', DEFAULT_BASE_COLOR))

    act(() => {
      useUiStore.getState().setBaseColor('#ff0000')
    })
    await waitFor(() => expect(sm.setMaterial).toHaveBeenCalledWith('metal', '#ff0000'))
  })

  it('calls the matching SceneManager method when background/showGrid/autoRotate/lightIntensity change', async () => {
    render(<Viewer />)
    const sm = MockSceneManager.instances[0]
    await waitFor(() => expect(sm.setModel).toHaveBeenCalled())

    act(() => useUiStore.getState().setBackground('light'))
    await waitFor(() => expect(sm.setBackground).toHaveBeenCalledWith('light'))

    act(() => useUiStore.getState().toggleGrid())
    await waitFor(() => expect(sm.setGrid).toHaveBeenCalledWith(true))

    act(() => useUiStore.getState().toggleAutoRotate())
    await waitFor(() => expect(sm.setAutoRotate).toHaveBeenCalledWith(true))

    act(() => useUiStore.getState().setLightIntensity(2))
    await waitFor(() => expect(sm.setLighting).toHaveBeenCalledWith('studio', 2))
  })

  it('calls resetCamera when resetCameraSignal increments, but not on mount', async () => {
    render(<Viewer />)
    const sm = MockSceneManager.instances[0]
    await waitFor(() => expect(sm.setModel).toHaveBeenCalled())

    expect(sm.resetCamera).not.toHaveBeenCalled()

    act(() => {
      useUiStore.getState().requestResetCamera()
    })
    await waitFor(() => expect(sm.resetCamera).toHaveBeenCalledTimes(1))

    act(() => {
      useUiStore.getState().requestResetCamera()
    })
    await waitFor(() => expect(sm.resetCamera).toHaveBeenCalledTimes(2))
  })

  it('disposes the SceneManager and disconnects the ResizeObserver on unmount', async () => {
    const { unmount } = render(<Viewer />)
    const sm = MockSceneManager.instances[0]
    await waitFor(() => expect(sm.setModel).toHaveBeenCalled())
    const ro = MockResizeObserver.instances[0]

    unmount()

    expect(sm.dispose).toHaveBeenCalledTimes(1)
    expect(ro.disconnect).toHaveBeenCalledTimes(1)
  })

  it('ignores a stale load result when the selection changes mid-flight', async () => {
    let resolveFirst: (v: { positions: Float32Array; stats: ModelStats }) => void = () => {}
    const firstPromise = new Promise<{ positions: Float32Array; stats: ModelStats }>((resolve) => {
      resolveFirst = resolve
    })
    const secondStats: ModelStats = { triCount: 2, vertCount: 6, bbox: { x: 2, y: 2, z: 2 } }
    const secondPositions = new Float32Array(18)

    loadModel.mockReset()
    loadModel.mockImplementationOnce(() => firstPromise)
    loadModel.mockImplementationOnce(() => Promise.resolve({ positions: secondPositions, stats: secondStats }))

    const secondFile: FileEntry = { path: '/root/b.stl', name: 'b.stl', size: 100, mtimeMs: 2 }
    const twoFileScan: ScanResult = { folders: [], files: [file, secondFile] }
    useUiStore.setState({ scan: twoFileScan, selectedIndex: 0 })

    render(<Viewer />)
    const sm = MockSceneManager.instances[0]

    await waitFor(() => expect(readFileBytes).toHaveBeenCalledTimes(1))

    act(() => {
      useUiStore.getState().select(1)
    })

    await waitFor(() => expect(readFileBytes).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(sm.setModel).toHaveBeenCalledWith(secondPositions))

    // Resolve the stale first load AFTER the second has already been applied
    // -- it must not clobber the second model or overwrite currentStats.
    await act(async () => {
      resolveFirst({ positions: new Float32Array(9), stats })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(sm.setModel).toHaveBeenCalledTimes(1)
    expect(sm.setModel).toHaveBeenCalledWith(secondPositions)
    expect(useUiStore.getState().currentStats).toEqual(secondStats)
  })
})
