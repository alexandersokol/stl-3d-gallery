// Factory for the model-preview materials offered in the viewer's material
// picker. Each preset maps to a specific three.js material type/config so
// SceneManager can swap materials on the fly without knowing the details of
// any individual preset.

import * as THREE from 'three'

export type MaterialPreset =
  | 'solidview'
  | 'matte'
  | 'glossy'
  | 'metal'
  | 'clay'
  | 'ceramic'
  | 'wireframe'
  | 'normals'
  | 'studio'

// The 3D-preview material picker shows presets in two groups separated by a
// divider: the everyday "primary" set first (Solid View is the preview
// default), then the rest. Keep these two arrays as the single source of
// truth for both ordering and grouping; MATERIAL_PRESETS below is their
// concatenation (the full list, in display order), used everywhere a flat
// list is enough (e.g. the Settings thumbnail-preset dropdown).
export const PRIMARY_MATERIAL_PRESETS: MaterialPreset[] = ['solidview', 'studio', 'normals', 'wireframe']
export const SECONDARY_MATERIAL_PRESETS: MaterialPreset[] = ['clay', 'matte', 'glossy', 'metal', 'ceramic']

export const MATERIAL_PRESETS: MaterialPreset[] = [...PRIMARY_MATERIAL_PRESETS, ...SECONDARY_MATERIAL_PRESETS]

// Human-friendly labels for the material picker / settings dropdown (the
// preset keys themselves are terse lowercase identifiers).
export const MATERIAL_PRESET_LABELS: Record<MaterialPreset, string> = {
  solidview: 'Solid View',
  studio: 'Studio',
  normals: 'Normals',
  wireframe: 'Wireframe',
  clay: 'Clay',
  matte: 'Matte',
  glossy: 'Glossy',
  metal: 'Metal',
  ceramic: 'Ceramic',
}

// Single source of truth for the default model base color (a mid-dark neutral
// grey clay). Applies to the lit presets (clay/matte/glossy/metal) and
// wireframe; the matcap presets (solidview/studio/ceramic) and normals ignore
// it. Consumed by the store's default `baseColor` and SceneManager's default
// so the viewer and info panel start from the same color.
export const DEFAULT_BASE_COLOR = '#7f8288'

/**
 * Builds the THREE.Material for a given preset.
 *
 * `baseColor` (a CSS hex string) is applied to the lit presets (clay, matte,
 * glossy, metal) and to wireframe; the matcap presets (solidview, studio,
 * ceramic) and the normals preset ignore it entirely since their appearance
 * comes from the baked-in matcap texture or the surface normal itself
 * (normals) instead.
 *
 * `matcaps` must contain pre-loaded textures for the matcap presets
 * (`solidview`, `studio`, `ceramic`); loading them is the caller's
 * responsibility (matcap loading touches the filesystem/network and doesn't
 * belong in a pure factory).
 */
export function makeMaterial(
  preset: MaterialPreset,
  baseColor: string,
  matcaps: Record<'solidview' | 'studio' | 'ceramic', THREE.Texture>,
): THREE.Material {
  switch (preset) {
    case 'solidview':
      // Blender "solid mode" look and the 3D-preview default: a neutral matte
      // grey clay with soft even shading and gentle ambient occlusion, baked
      // into a matcap so it's flat/consistent regardless of orientation or
      // the scene's lights. baseColor is ignored (the matcap defines it).
      return new THREE.MeshMatcapMaterial({ matcap: matcaps.solidview })
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
