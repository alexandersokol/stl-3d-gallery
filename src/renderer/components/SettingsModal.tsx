// Centered modal overlay for app settings: the viewer's camera navigation
// mode, the thumbnail render preset, and an optional Blender executable
// override (for "Open in Blender"). All are backed by useUiStore fields that persist to localStorage (see
// state/store.ts), so choices survive an app restart.
//
// Closes via Esc, clicking the backdrop, or the close (X) button -- the
// same dismissal affordances as ReferenceImage's enlarged-image overlay.

import { useEffect, useState } from 'react'
import { useUiStore, type CameraMode } from '../state/store'
import { MATERIAL_PRESETS, MATERIAL_PRESET_LABELS } from '../viewer/materials'
import { CloseIcon } from '../assets/icons'
import { api } from '../ipc/api'

const CAMERA_MODE_OPTIONS: { value: CameraMode; label: string }[] = [
  { value: 'fly', label: 'Fly through / inside' },
  { value: 'surface', label: 'Zoom to surface' },
]

export default function SettingsModal() {
  const settingsOpen = useUiStore((s) => s.settingsOpen)
  const closeSettings = useUiStore((s) => s.closeSettings)
  const cameraMode = useUiStore((s) => s.cameraMode)
  const setCameraMode = useUiStore((s) => s.setCameraMode)
  const thumbnailPreset = useUiStore((s) => s.thumbnailPreset)
  const setThumbnailPreset = useUiStore((s) => s.setThumbnailPreset)
  const blenderPath = useUiStore((s) => s.blenderPath)
  const setBlenderPath = useUiStore((s) => s.setBlenderPath)

  // The auto-detected Blender, shown as the override field's placeholder so
  // the user can see what an empty field resolves to. Looked up each time the
  // modal opens (cheap: a handful of stat calls in main).
  const [detectedBlender, setDetectedBlender] = useState<string | null>(null)
  useEffect(() => {
    if (!settingsOpen) return
    let cancelled = false
    api
      .detectBlender()
      .then((p) => {
        if (!cancelled) setDetectedBlender(p)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [settingsOpen])

  // Esc closes the modal while it's open. Attached only when open, and torn
  // down on close/unmount, so it never intercepts Esc elsewhere in the app
  // (e.g. App.tsx's own Escape handler for leaving viewer mode).
  useEffect(() => {
    if (!settingsOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault() // tells App's global shortcuts this Esc is handled
        closeSettings()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [settingsOpen, closeSettings])

  if (!settingsOpen) return null

  return (
    <div className="settings-overlay" onClick={closeSettings}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>Settings</h2>
          <button type="button" className="settings-close" aria-label="Close" onClick={closeSettings}>
            <CloseIcon />
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-section">
            <h3>Viewer</h3>
            <div className="settings-field">
              <span className="settings-field-label">Camera navigation</span>
              <div className="settings-segmented" role="radiogroup" aria-label="Camera navigation">
                {CAMERA_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={cameraMode === opt.value}
                    className={cameraMode === opt.value ? 'settings-segment settings-segment-active' : 'settings-segment'}
                    onClick={() => setCameraMode(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="settings-hint">
                Fly-through lets the camera pass into the model; zoom-to-surface stops at the surface.
              </p>
            </div>
          </section>

          <section className="settings-section">
            <h3>Thumbnails</h3>
            <div className="settings-field">
              <label className="settings-field-label" htmlFor="settings-thumbnail-preset">
                Thumbnail render preset
              </label>
              <select
                id="settings-thumbnail-preset"
                className="settings-select"
                value={thumbnailPreset}
                onChange={(e) => setThumbnailPreset(e.target.value as (typeof MATERIAL_PRESETS)[number])}
              >
                {MATERIAL_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {MATERIAL_PRESET_LABELS[preset]}
                  </option>
                ))}
              </select>
              <p className="settings-hint">
                Controls how grid and filmstrip thumbnails are rendered. Changing it regenerates thumbnails.
              </p>
            </div>
          </section>

          <section className="settings-section">
            <h3>Blender</h3>
            <div className="settings-field">
              <label className="settings-field-label" htmlFor="settings-blender-path">
                Blender executable
              </label>
              <input
                id="settings-blender-path"
                type="text"
                className="settings-select"
                spellCheck={false}
                value={blenderPath}
                placeholder={detectedBlender ?? 'Not found — enter the path to Blender'}
                onChange={(e) => setBlenderPath(e.target.value)}
              />
              <p className="settings-hint">
                Used by “Open in Blender”. Leave empty to auto-detect. On macOS you can enter the .app bundle.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
