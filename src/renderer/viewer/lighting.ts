// Factory for the model-preview lighting rigs offered in the viewer's
// lighting picker. Each preset returns a fresh, unparented array of
// THREE.Light instances; SceneManager is responsible for adding them to
// (and removing the previous rig from) the scene.

import * as THREE from 'three'

export type LightPreset = 'studio' | 'soft' | 'dramatic' | 'top'

export const LIGHT_PRESETS: LightPreset[] = ['studio', 'soft', 'dramatic', 'top']

/**
 * Builds the light rig for a given preset. `intensity` uniformly scales
 * every light's base intensity (ambient/fill included) so the whole rig can
 * be brightened or dimmed as one unit without changing its character.
 */
export function makeLights(preset: LightPreset, intensity: number): THREE.Light[] {
  switch (preset) {
    case 'studio': {
      const key = new THREE.DirectionalLight(0xffffff, 1.0 * intensity)
      key.position.set(2, 3, 4)

      const fill = new THREE.DirectionalLight(0xffffff, 0.45 * intensity)
      fill.position.set(-3, 1, 2)

      const rim = new THREE.DirectionalLight(0xffffff, 0.6 * intensity)
      rim.position.set(-1, 2, -4)

      const ambient = new THREE.AmbientLight(0xffffff, 0.35 * intensity)

      return [key, fill, rim, ambient]
    }
    case 'soft': {
      const hemi = new THREE.HemisphereLight(0xffffff, 0x8896a8, 0.9 * intensity)
      hemi.position.set(0, 5, 0)

      const ambient = new THREE.AmbientLight(0xffffff, 0.2 * intensity)

      return [hemi, ambient]
    }
    case 'dramatic': {
      const key = new THREE.DirectionalLight(0xffffff, 1.8 * intensity)
      key.position.set(4, 2, 1)

      const ambient = new THREE.AmbientLight(0xffffff, 0.08 * intensity)

      return [key, ambient]
    }
    case 'top': {
      const overhead = new THREE.DirectionalLight(0xffffff, 1.3 * intensity)
      overhead.position.set(0, 6, 0.5)

      const ambient = new THREE.AmbientLight(0xffffff, 0.15 * intensity)

      return [overhead, ambient]
    }
  }
}
