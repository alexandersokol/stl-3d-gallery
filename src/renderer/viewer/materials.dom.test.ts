// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { MATERIAL_PRESETS, makeMaterial, DEFAULT_BASE_COLOR, type MaterialPreset } from './materials'

const matcaps: Record<'studio' | 'ceramic', THREE.Texture> = {
  studio: new THREE.Texture(),
  ceramic: new THREE.Texture(),
}

describe('MATERIAL_PRESETS', () => {
  it('lists all eight presets in order, clay first and studio last', () => {
    const expected: MaterialPreset[] = [
      'clay',
      'matte',
      'glossy',
      'metal',
      'ceramic',
      'wireframe',
      'normals',
      'studio',
    ]
    expect(MATERIAL_PRESETS).toEqual(expected)
    expect(MATERIAL_PRESETS[0]).toBe('clay')
    // 'studio' is the dedicated thumbnail-renderer preset; it lives last in
    // the 3D-preview picker since its primary home is the thumbnails.
    expect(MATERIAL_PRESETS[MATERIAL_PRESETS.length - 1]).toBe('studio')
    expect(MATERIAL_PRESETS).toHaveLength(8)
  })
})

describe('makeMaterial', () => {
  it('matte -> MeshStandardMaterial with high roughness, no metalness', () => {
    const m = makeMaterial('matte', DEFAULT_BASE_COLOR, matcaps)
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial)
    const std = m as THREE.MeshStandardMaterial
    expect(std.roughness).toBe(0.9)
    expect(std.metalness).toBe(0)
    expect(std.color.getHexString()).toBe(DEFAULT_BASE_COLOR.replace('#', ''))
  })

  it('glossy -> MeshStandardMaterial with low roughness, no metalness', () => {
    const m = makeMaterial('glossy', DEFAULT_BASE_COLOR, matcaps)
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial)
    const std = m as THREE.MeshStandardMaterial
    expect(std.roughness).toBe(0.15)
    expect(std.metalness).toBe(0)
  })

  it('metal -> MeshStandardMaterial fully metallic', () => {
    const m = makeMaterial('metal', DEFAULT_BASE_COLOR, matcaps)
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial)
    const std = m as THREE.MeshStandardMaterial
    expect(std.roughness).toBe(0.35)
    expect(std.metalness).toBe(1)
  })

  it('clay -> MeshStandardMaterial with medium roughness, no metalness (studio clay)', () => {
    const m = makeMaterial('clay', DEFAULT_BASE_COLOR, matcaps)
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial)
    const std = m as THREE.MeshStandardMaterial
    expect(std.roughness).toBe(0.7)
    expect(std.metalness).toBe(0)
    expect(std.color.getHexString()).toBe(DEFAULT_BASE_COLOR.replace('#', ''))
  })

  it('ceramic -> MeshMatcapMaterial using the ceramic matcap texture', () => {
    const m = makeMaterial('ceramic', '#fff', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshMatcapMaterial)
    expect((m as THREE.MeshMatcapMaterial).matcap).toBe(matcaps.ceramic)
  })

  it('studio -> MeshMatcapMaterial using the studio matcap texture, ignoring baseColor', () => {
    const m = makeMaterial('studio', '#ff0000', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshMatcapMaterial)
    // A matcap bakes its own color; baseColor must not leak in (that's what
    // keeps thumbnail and 3D-preview shading identical).
    expect((m as THREE.MeshMatcapMaterial).matcap).toBe(matcaps.studio)
  })

  it('wireframe -> basic material with wireframe enabled', () => {
    const m = makeMaterial('wireframe', '#fff', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshBasicMaterial)
    expect((m as THREE.MeshBasicMaterial).wireframe).toBe(true)
  })

  it('normals -> MeshNormalMaterial ignoring baseColor', () => {
    const m = makeMaterial('normals', '#fff', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshNormalMaterial)
  })
})
