// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { MATERIAL_PRESETS, makeMaterial, type MaterialPreset } from './materials'

const matcaps: Record<'clay' | 'ceramic', THREE.Texture> = {
  clay: new THREE.Texture(),
  ceramic: new THREE.Texture(),
}

describe('MATERIAL_PRESETS', () => {
  it('lists all six presets in order', () => {
    const expected: MaterialPreset[] = ['matte', 'glossy', 'metal', 'clay', 'ceramic', 'wireframe']
    expect(MATERIAL_PRESETS).toEqual(expected)
    expect(MATERIAL_PRESETS).toHaveLength(6)
  })
})

describe('makeMaterial', () => {
  it('matte -> MeshStandardMaterial with high roughness, no metalness', () => {
    const m = makeMaterial('matte', '#b0b6be', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial)
    const std = m as THREE.MeshStandardMaterial
    expect(std.roughness).toBe(0.85)
    expect(std.metalness).toBe(0)
    expect(std.color.getHexString()).toBe('b0b6be')
  })

  it('glossy -> MeshStandardMaterial with low roughness, no metalness', () => {
    const m = makeMaterial('glossy', '#b0b6be', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial)
    const std = m as THREE.MeshStandardMaterial
    expect(std.roughness).toBe(0.15)
    expect(std.metalness).toBe(0)
  })

  it('metal -> MeshStandardMaterial fully metallic', () => {
    const m = makeMaterial('metal', '#b0b6be', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshStandardMaterial)
    const std = m as THREE.MeshStandardMaterial
    expect(std.roughness).toBe(0.35)
    expect(std.metalness).toBe(1)
  })

  it('clay -> MeshMatcapMaterial using the clay matcap texture', () => {
    const m = makeMaterial('clay', '#fff', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshMatcapMaterial)
    expect((m as THREE.MeshMatcapMaterial).matcap).toBe(matcaps.clay)
  })

  it('ceramic -> MeshMatcapMaterial using the ceramic matcap texture', () => {
    const m = makeMaterial('ceramic', '#fff', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshMatcapMaterial)
    expect((m as THREE.MeshMatcapMaterial).matcap).toBe(matcaps.ceramic)
  })

  it('wireframe -> basic material with wireframe enabled', () => {
    const m = makeMaterial('wireframe', '#fff', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshBasicMaterial)
    expect((m as THREE.MeshBasicMaterial).wireframe).toBe(true)
  })
})
