// Factory for the model-preview materials offered in the viewer's material
// picker. Each preset maps to a specific three.js material type/config so
// SceneManager can swap materials on the fly without knowing the details of
// any individual preset.

import * as THREE from 'three'

export type MaterialPreset = 'matte' | 'glossy' | 'metal' | 'clay' | 'ceramic' | 'wireframe'

export const MATERIAL_PRESETS: MaterialPreset[] = ['matte', 'glossy', 'metal', 'clay', 'ceramic', 'wireframe']

/**
 * Builds the THREE.Material for a given preset.
 *
 * `baseColor` (a CSS hex string) is applied to the lit presets (matte,
 * glossy, metal) and to wireframe; the matcap presets (clay, ceramic)
 * ignore it entirely since their appearance comes from the baked-in
 * matcap texture instead.
 *
 * `matcaps` must contain pre-loaded textures for the clay/ceramic presets;
 * loading them is the caller's responsibility (matcap loading touches the
 * filesystem/network and doesn't belong in a pure factory).
 */
export function makeMaterial(
  preset: MaterialPreset,
  baseColor: string,
  matcaps: Record<'clay' | 'ceramic', THREE.Texture>,
): THREE.Material {
  switch (preset) {
    case 'matte':
      return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.85, metalness: 0.0 })
    case 'glossy':
      return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.15, metalness: 0.0 })
    case 'metal':
      return new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.35, metalness: 1.0 })
    case 'clay':
      return new THREE.MeshMatcapMaterial({ matcap: matcaps.clay })
    case 'ceramic':
      return new THREE.MeshMatcapMaterial({ matcap: matcaps.ceramic })
    case 'wireframe':
      return new THREE.MeshBasicMaterial({ color: baseColor, wireframe: true })
  }
}
