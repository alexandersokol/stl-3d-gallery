// Factory for the model-preview materials offered in the viewer's material
// picker. Each preset maps to a specific three.js material type/config so
// SceneManager can swap materials on the fly without knowing the details of
// any individual preset.

import * as THREE from 'three'

export type MaterialPreset =
  | 'matte'
  | 'glossy'
  | 'metal'
  | 'clay'
  | 'ceramic'
  | 'wireframe'
  | 'normals'
  | 'studio'

export const MATERIAL_PRESETS: MaterialPreset[] = [
  'clay',
  'matte',
  'glossy',
  'metal',
  'ceramic',
  'wireframe',
  'normals',
  // 'studio' is the dedicated thumbnail-renderer preset; it's offered in the
  // 3D-preview material picker too, but listed LAST since its primary home is
  // the thumbnails (it's their default). See makeMaterial() / matcaps.ts.
  'studio',
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
 * glossy, metal) and to wireframe; the matcap presets (studio, ceramic) and
 * the normals preset ignore it entirely since their appearance comes from the
 * baked-in matcap texture or the surface normal itself (normals) instead.
 *
 * `matcaps` must contain pre-loaded textures for the matcap presets
 * (`studio`, `ceramic`); loading them is the caller's responsibility (matcap
 * loading touches the filesystem/network and doesn't belong in a pure
 * factory).
 */
export function makeMaterial(
  preset: MaterialPreset,
  baseColor: string,
  matcaps: Record<'studio' | 'ceramic', THREE.Texture>,
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
    case 'studio':
      // Dedicated thumbnail-renderer preset. A matcap bakes its lighting,
      // soft shadow and color into the texture and ignores the scene's
      // lights/environment, so it renders identically in the offscreen
      // thumbnailer and the live viewer (their light rigs differ). baseColor
      // is intentionally ignored — the look is fully defined by the matcap.
      return new THREE.MeshMatcapMaterial({ matcap: matcaps.studio })
    case 'wireframe':
      return new THREE.MeshBasicMaterial({ color: baseColor, wireframe: true })
    case 'normals':
      return new THREE.MeshNormalMaterial()
  }
}
