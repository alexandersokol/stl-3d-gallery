// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { LIGHT_PRESETS, makeLights, type LightPreset } from './lighting'

describe('LIGHT_PRESETS', () => {
  it('lists all four presets in order', () => {
    const expected: LightPreset[] = ['studio', 'soft', 'dramatic', 'top']
    expect(LIGHT_PRESETS).toEqual(expected)
    expect(LIGHT_PRESETS).toHaveLength(4)
  })
})

describe('makeLights', () => {
  it('studio: exactly 3 DirectionalLight + 1 AmbientLight', () => {
    const lights = makeLights('studio', 1)
    const directional = lights.filter((l) => l instanceof THREE.DirectionalLight)
    const ambient = lights.filter((l) => l instanceof THREE.AmbientLight)
    expect(directional).toHaveLength(3)
    expect(ambient).toHaveLength(1)
    expect(lights).toHaveLength(4)
  })

  it('soft: contains a HemisphereLight and an AmbientLight', () => {
    const lights = makeLights('soft', 1)
    const hemi = lights.filter((l) => l instanceof THREE.HemisphereLight)
    const ambient = lights.filter((l) => l instanceof THREE.AmbientLight)
    expect(hemi).toHaveLength(1)
    expect(ambient).toHaveLength(1)
  })

  it('dramatic: one strong DirectionalLight + one low AmbientLight', () => {
    const lights = makeLights('dramatic', 1)
    const directional = lights.filter((l) => l instanceof THREE.DirectionalLight)
    const ambient = lights.filter((l) => l instanceof THREE.AmbientLight)
    expect(directional).toHaveLength(1)
    expect(ambient).toHaveLength(1)
  })

  it('top: one overhead DirectionalLight + one low AmbientLight', () => {
    const lights = makeLights('top', 1)
    const directional = lights.filter((l): l is THREE.DirectionalLight => l instanceof THREE.DirectionalLight)
    const ambient = lights.filter((l) => l instanceof THREE.AmbientLight)
    expect(directional).toHaveLength(1)
    expect(ambient).toHaveLength(1)
    expect(directional[0].position.y).toBeGreaterThan(0)
  })

  it('scales all light intensities by the intensity factor', () => {
    for (const preset of LIGHT_PRESETS) {
      const base = makeLights(preset, 1)
      const scaled = makeLights(preset, 2)
      expect(scaled).toHaveLength(base.length)
      for (let i = 0; i < base.length; i++) {
        expect(scaled[i].intensity).toBeCloseTo(base[i].intensity * 2)
      }
    }
  })
})
