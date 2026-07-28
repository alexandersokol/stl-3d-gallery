// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  MATERIAL_PRESETS,
  PRIMARY_MATERIAL_PRESETS,
  SECONDARY_MATERIAL_PRESETS,
  MATERIAL_PRESET_LABELS,
  makeMaterial,
  makeOutlineMaterial,
  DEFAULT_BASE_COLOR,
  type MaterialPreset,
} from './materials'

const matcaps: Record<'solidview' | 'studio' | 'ceramic' | 'comic', THREE.Texture> = {
  solidview: new THREE.Texture(),
  studio: new THREE.Texture(),
  ceramic: new THREE.Texture(),
  comic: new THREE.Texture(),
}

describe('MATERIAL_PRESETS', () => {
  it('is the primary group followed by the secondary group, in display order', () => {
    // Picker order: Solid View / Studio / Comic / Normals / Wireframe | rest.
    const expected: MaterialPreset[] = [
      'solidview',
      'studio',
      'comic',
      'normals',
      'wireframe',
      'clay',
      'matte',
      'glossy',
      'metal',
      'ceramic',
    ]
    expect(MATERIAL_PRESETS).toEqual(expected)
    expect(MATERIAL_PRESETS).toEqual([...PRIMARY_MATERIAL_PRESETS, ...SECONDARY_MATERIAL_PRESETS])
    // 'solidview' is the 3D-preview default, listed first.
    expect(MATERIAL_PRESETS[0]).toBe('solidview')
    expect(MATERIAL_PRESETS).toHaveLength(10)
  })

  it('has a friendly label for every preset', () => {
    for (const preset of MATERIAL_PRESETS) {
      expect(MATERIAL_PRESET_LABELS[preset]).toBeTruthy()
    }
    expect(MATERIAL_PRESET_LABELS.solidview).toBe('Solid View')
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

  it('solidview -> MeshMatcapMaterial using the solidview matcap texture, ignoring baseColor', () => {
    const m = makeMaterial('solidview', '#ff0000', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshMatcapMaterial)
    expect((m as THREE.MeshMatcapMaterial).matcap).toBe(matcaps.solidview)
  })

  it('studio -> MeshMatcapMaterial using the studio matcap texture, ignoring baseColor', () => {
    const m = makeMaterial('studio', '#ff0000', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshMatcapMaterial)
    // A matcap bakes its own color; baseColor must not leak in (that's what
    // keeps thumbnail and 3D-preview shading identical).
    expect((m as THREE.MeshMatcapMaterial).matcap).toBe(matcaps.studio)
  })

  it('comic -> MeshMatcapMaterial using the comic matcap texture, ignoring baseColor', () => {
    const m = makeMaterial('comic', '#ff0000', matcaps)
    expect(m).toBeInstanceOf(THREE.MeshMatcapMaterial)
    expect((m as THREE.MeshMatcapMaterial).matcap).toBe(matcaps.comic)
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

describe('makeOutlineMaterial', () => {
  it('is a black back-face basic material that pushes vertices along normals', () => {
    const m = makeOutlineMaterial(0.5) as THREE.MeshBasicMaterial
    expect(m).toBeInstanceOf(THREE.MeshBasicMaterial)
    expect(m.side).toBe(THREE.BackSide)
    expect(m.color.getHexString()).toBe('000000')

    // The normal-push is injected via onBeforeCompile; run it and confirm the
    // shader carries the thickness uniform + displacement.
    const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: '#include <begin_vertex>' }
    m.onBeforeCompile?.(shader as never, undefined as never)
    expect(shader.uniforms.outlineThickness.value).toBe(0.5)
    expect(shader.vertexShader).toContain('outlineThickness')
    expect(shader.vertexShader).toContain('normalize( normal )')
  })
})
