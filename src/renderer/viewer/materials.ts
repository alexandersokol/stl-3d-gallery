// Factory for the model-preview materials offered in the viewer's material
// picker. Each preset maps to a specific three.js material type/config so
// SceneManager can swap materials on the fly without knowing the details of
// any individual preset.

import * as THREE from 'three'

export type MaterialPreset = 'matte' | 'glossy' | 'metal' | 'clay' | 'ceramic' | 'wireframe' | 'normals'

export const MATERIAL_PRESETS: MaterialPreset[] = [
  'clay',
  'matte',
  'glossy',
  'metal',
  'ceramic',
  'wireframe',
  'normals',
]

// Single source of truth for the default model base color (a medium neutral
// grey, matching a studio clay render). Consumed by the store's default
// `baseColor`, SceneManager's default, and thumbnailer's matte material so
// the viewer, thumbnails, and info panel all start from the same color.
export const DEFAULT_BASE_COLOR = '#a9adb3'

/**
 * Builds the THREE.Material for a given preset.
 *
 * `baseColor` (a CSS hex string) is applied to the lit presets (clay, matte,
 * glossy, metal) and to wireframe; the ceramic matcap preset and the normals
 * preset ignore it entirely since their appearance comes from the baked-in
 * ceramic matcap texture or the surface normal itself (normals) instead.
 *
 * `matcaps` must contain a pre-loaded texture for the ceramic preset;
 * loading it is the caller's responsibility (matcap loading touches the
 * filesystem/network and doesn't belong in a pure factory).
 */
export function makeMaterial(
  preset: MaterialPreset,
  baseColor: string,
  matcaps: Record<'clay' | 'ceramic', THREE.Texture>,
): THREE.Material {
  switch (preset) {
    case 'clay':
      // Studio clay: a lit (not matcap) material so it responds to the
      // scene's lighting rig, giving the soft form-revealing look of a
      // clay render on a grey studio backdrop.
      return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.7, metalness: 0.0 })
    case 'matte':
      return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9, metalness: 0.0 })
    case 'glossy':
      return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.15, metalness: 0.0 })
    case 'metal':
      return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.35, metalness: 1.0 })
    case 'ceramic':
      return new THREE.MeshMatcapMaterial({ matcap: matcaps.ceramic })
    case 'wireframe':
      return new THREE.MeshBasicMaterial({ color: baseColor, wireframe: true })
    case 'normals':
      return new THREE.MeshNormalMaterial()
  }
}
