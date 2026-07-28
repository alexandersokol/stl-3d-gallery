// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { tintNegativeAxisSprites } from './viewHelperTint'

// jsdom ships no 2D canvas backend, so getContext('2d') returns null. The tint
// only draws a filled circle, so a no-op context stub is enough for it to run.
let getContextSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  const fakeCtx = {
    beginPath: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
  }
  getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(fakeCtx as unknown as CanvasRenderingContext2D)
})

afterEach(() => {
  getContextSpy.mockRestore()
})

// Mirrors stock ViewHelper: three negative-axis sprites sharing ONE black,
// low-opacity material, plus a positive sprite that must be left alone.
function buildFakeGizmo() {
  const root = new THREE.Object3D()
  const shared = new THREE.SpriteMaterial({ color: 0x000000 })
  shared.opacity = 0.2

  const sprites: Record<string, THREE.Sprite> = {}
  for (const type of ['negX', 'negY', 'negZ']) {
    const s = new THREE.Sprite(shared)
    s.userData.type = type
    root.add(s)
    sprites[type] = s
  }

  const pos = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff4466 }))
  pos.userData.type = 'posX'
  root.add(pos)
  sprites.posX = pos

  return { root, shared, sprites }
}

describe('tintNegativeAxisSprites', () => {
  it('replaces each negative-axis sprite material with a distinct opaque dot', () => {
    const { root, shared, sprites } = buildFakeGizmo()

    tintNegativeAxisSprites(root)

    const negMats = ['negX', 'negY', 'negZ'].map((t) => sprites[t].material as THREE.SpriteMaterial)
    for (const mat of negMats) {
      expect(mat).not.toBe(shared) // no longer the shared black material
      expect(mat.opacity).toBe(1) // opaque, unlike the 0.2 original
      expect(mat.map).toBeInstanceOf(THREE.CanvasTexture) // freshly drawn dot
    }
    // Each negative axis gets its OWN material (distinct colours).
    expect(new Set(negMats).size).toBe(3)
  })

  it('leaves the positive-axis sprite untouched', () => {
    const { root, sprites } = buildFakeGizmo()
    const before = sprites.posX.material

    tintNegativeAxisSprites(root)

    expect(sprites.posX.material).toBe(before)
  })
})
