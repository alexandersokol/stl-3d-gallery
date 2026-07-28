// Owns the <canvas> and drives the imperative three.js SceneManager off of
// the Zustand store: loads the selected model, keeps the engine's material/
// lighting/background/grid/auto-rotate in sync with store settings, and
// resizes the renderer when its container changes size.
//
// This component intentionally has NO toolbar, filmstrip, or keyboard
// handling -- that's Task 4.3b, layered on top of App. Viewer here is just
// the canvas + engine wiring.

import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '../state/store'
import { api } from '../ipc/api'
import { loadModel } from '../lib/load-model'
import { SceneManager } from '../viewer/SceneManager'

export default function Viewer() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<SceneManager | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

  const scan = useUiStore((s) => s.scan)
  const selectedIndex = useUiStore((s) => s.selectedIndex)
  const material = useUiStore((s) => s.material)
  const baseColor = useUiStore((s) => s.baseColor)
  const lighting = useUiStore((s) => s.lighting)
  const lightIntensity = useUiStore((s) => s.lightIntensity)
  const background = useUiStore((s) => s.background)
  const cameraMode = useUiStore((s) => s.cameraMode)
  const showGrid = useUiStore((s) => s.showGrid)
  const autoRotate = useUiStore((s) => s.autoRotate)
  const setCurrentStats = useUiStore((s) => s.setCurrentStats)
  const resetCameraSignal = useUiStore((s) => s.resetCameraSignal)

  // TODO(phase5): when scan/selectedIndex become null (e.g. navigating back
  // to an empty folder while still in viewer mode), `file` below goes null
  // and the load-effect just returns early -- the last-loaded mesh and
  // `currentStats` are left in place rather than cleared. Revisit once
  // Phase 5's InfoPanel depends on `currentStats` always reflecting the
  // current selection.
  const file = scan !== null && selectedIndex !== null ? (scan.files[selectedIndex] ?? null) : null

  // Create the engine once per mount, tear it down on unmount. This effect
  // must run (and populate sceneRef) before the settings-sync effects below
  // so their "apply once on creation" initial run has a live SceneManager
  // to call into.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const sceneManager = new SceneManager(canvas)
    sceneRef.current = sceneManager

    return () => {
      sceneManager.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.setMaterial(material, baseColor)
  }, [material, baseColor])

  useEffect(() => {
    sceneRef.current?.setLighting(lighting, lightIntensity)
  }, [lighting, lightIntensity])

  useEffect(() => {
    sceneRef.current?.setBackground(background)
  }, [background])

  useEffect(() => {
    sceneRef.current?.setCameraMode(cameraMode)
  }, [cameraMode])

  useEffect(() => {
    sceneRef.current?.setGrid(showGrid)
  }, [showGrid])

  useEffect(() => {
    sceneRef.current?.setAutoRotate(autoRotate)
  }, [autoRotate])

  // `resetCameraSignal` starts at 0 and only ever increments, via the
  // toolbar's "Reset camera" button calling requestResetCamera(). The ref
  // below skips the effect's initial run (mount) so mounting Viewer never
  // itself triggers a spurious resetCamera() call -- only a real increment
  // after mount does.
  const skipInitialResetRef = useRef(true)
  useEffect(() => {
    if (skipInitialResetRef.current) {
      skipInitialResetRef.current = false
      return
    }
    sceneRef.current?.resetCamera()
  }, [resetCameraSignal])

  // Loads the selected model whenever the selection changes. Guards against
  // the classic async race: if the selection changes again before this
  // load's readFileBytes -> loadModel round trip resolves, the effect
  // cleanup below flips `cancelled` and the stale result is dropped instead
  // of being applied over whatever the newer selection already produced.
  useEffect(() => {
    if (!file) return

    let cancelled = false
    setLoadError(null)

    void (async () => {
      try {
        const bytes = await api.readFileBytes(file.path)
        if (cancelled) return
        const { positions, stats } = await loadModel(bytes)
        if (cancelled) return
        sceneRef.current?.setModel(positions)
        setCurrentStats(stats)
      } catch (err) {
        if (cancelled) return
        console.error(`Viewer: failed to load model ${file.path}`, err)
        setLoadError('Failed to load model')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [file, setCurrentStats])

  // Keeps the renderer's drawing buffer matched to the container's actual
  // pixel size (the canvas itself is styled to fill it via CSS).
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      sceneRef.current?.resize(width, height)
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="viewer">
      <canvas ref={canvasRef} className="viewer-canvas" />
      {loadError && (
        <div className="viewer-error" role="alert">
          {loadError}
        </div>
      )}
    </div>
  )
}
