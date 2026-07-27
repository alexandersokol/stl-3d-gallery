// Compact horizontal toolbar for viewer mode: material/lighting presets,
// base color, light intensity, background/grid/auto-rotate toggles, camera
// reset, and prev/next navigation. Pure controls bound to useUiStore --
// icons and visual polish are a later pass (Phase 7.3); text labels only
// for now.

import { useUiStore } from '../state/store'
import { MATERIAL_PRESETS } from '../viewer/materials'
import { LIGHT_PRESETS } from '../viewer/lighting'

export default function ViewerToolbar() {
  const material = useUiStore((s) => s.material)
  const setMaterial = useUiStore((s) => s.setMaterial)
  const baseColor = useUiStore((s) => s.baseColor)
  const setBaseColor = useUiStore((s) => s.setBaseColor)
  const lighting = useUiStore((s) => s.lighting)
  const setLighting = useUiStore((s) => s.setLighting)
  const lightIntensity = useUiStore((s) => s.lightIntensity)
  const setLightIntensity = useUiStore((s) => s.setLightIntensity)
  const background = useUiStore((s) => s.background)
  const setBackground = useUiStore((s) => s.setBackground)
  const showGrid = useUiStore((s) => s.showGrid)
  const toggleGrid = useUiStore((s) => s.toggleGrid)
  const autoRotate = useUiStore((s) => s.autoRotate)
  const toggleAutoRotate = useUiStore((s) => s.toggleAutoRotate)
  const requestResetCamera = useUiStore((s) => s.requestResetCamera)
  const prev = useUiStore((s) => s.prev)
  const next = useUiStore((s) => s.next)

  return (
    <div className="viewer-toolbar">
      <div className="toolbar-group" role="group" aria-label="Material">
        {MATERIAL_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="toolbar-button"
            aria-pressed={material === preset}
            onClick={() => setMaterial(preset)}
          >
            {preset}
          </button>
        ))}
        <input
          type="color"
          aria-label="Base color"
          className="toolbar-color-input"
          value={baseColor}
          onChange={(e) => setBaseColor(e.target.value)}
        />
      </div>

      <div className="toolbar-group" role="group" aria-label="Lighting">
        {LIGHT_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="toolbar-button"
            aria-pressed={lighting === preset}
            onClick={() => setLighting(preset)}
          >
            {preset}
          </button>
        ))}
        <label className="toolbar-range-label">
          Intensity
          <input
            type="range"
            aria-label="Light intensity"
            min={0}
            max={3}
            step={0.1}
            value={lightIntensity}
            onChange={(e) => setLightIntensity(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="toolbar-group" role="group" aria-label="Scene">
        <button
          type="button"
          className="toolbar-button"
          aria-pressed={background === 'dark'}
          onClick={() => setBackground(background === 'dark' ? 'light' : 'dark')}
        >
          Background: {background}
        </button>
        <button type="button" className="toolbar-button" aria-pressed={showGrid} onClick={toggleGrid}>
          Show grid
        </button>
        <button type="button" className="toolbar-button" aria-pressed={autoRotate} onClick={toggleAutoRotate}>
          Auto-rotate
        </button>
        <button type="button" className="toolbar-button" onClick={requestResetCamera}>
          Reset camera
        </button>
      </div>

      <div className="toolbar-group" role="group" aria-label="Navigation">
        <button type="button" className="toolbar-button" onClick={prev}>
          Prev
        </button>
        <button type="button" className="toolbar-button" onClick={next}>
          Next
        </button>
      </div>
    </div>
  )
}
