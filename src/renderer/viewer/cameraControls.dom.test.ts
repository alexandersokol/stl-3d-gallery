// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { fitCameraToObject } from './cameraControls'

// The model's bounding sphere is now passed explicitly (center + radius),
// computed by the caller from the geometry's own boundingSphere — see the
// function's doc comment for why we no longer re-derive a Box3 here.
const CENTER = new THREE.Vector3(5, 1, -2)
const RADIUS = 3

function setup() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
  const canvas = document.createElement('canvas')
  const controls = new OrbitControls(camera, canvas)
  return { camera, controls }
}

describe('fitCameraToObject (smoke)', () => {
  it('moves the camera to a finite, non-origin position and centers controls.target on the object', () => {
    const { camera, controls } = setup()
    fitCameraToObject(camera, controls, CENTER, RADIUS)

    expect(Number.isFinite(camera.position.x)).toBe(true)
    expect(Number.isFinite(camera.position.y)).toBe(true)
    expect(Number.isFinite(camera.position.z)).toBe(true)
    expect(camera.position.length()).toBeGreaterThan(0)

    expect(controls.target.x).toBeCloseTo(5, 5)
    expect(controls.target.y).toBeCloseTo(1, 5)
    expect(controls.target.z).toBeCloseTo(-2, 5)

    controls.dispose()
  })
})

describe('fitCameraToObject (Z-up orientation)', () => {
  it('sets camera.up to +Z so the model stands upright under Z-up STL conventions', () => {
    const { camera, controls } = setup()
    fitCameraToObject(camera, controls, CENTER, RADIUS)

    expect(camera.up.x).toBe(0)
    expect(camera.up.y).toBe(0)
    expect(camera.up.z).toBe(1)

    controls.dispose()
  })

  it('centers controls.target on the object and positions the camera above it in Z', () => {
    const { camera, controls } = setup()
    fitCameraToObject(camera, controls, CENTER, RADIUS)

    expect(controls.target.x).toBeCloseTo(CENTER.x, 5)
    expect(controls.target.y).toBeCloseTo(CENTER.y, 5)
    expect(controls.target.z).toBeCloseTo(CENTER.z, 5)

    // Z-up: the camera should sit above the model's center (higher Z),
    // viewing from the front-right (dir = (1, -1, 0.75).normalize()).
    expect(camera.position.z).toBeGreaterThan(CENTER.z)
  })
})

describe('fitCameraToObject (framing distance)', () => {
  it('places the camera at distance = radius / (sin(vFov/2) * fill), scaling with radius', () => {
    const { camera, controls } = setup()
    const fill = 0.8
    fitCameraToObject(camera, controls, CENTER, RADIUS, fill)

    const vFov = (camera.fov * Math.PI) / 180
    const expected = RADIUS / (Math.sin(vFov / 2) * fill)
    const dist = camera.position.distanceTo(controls.target)
    // Regression guard: a wrong (tiny) radius here produced an extreme
    // zoomed-in initial view. Distance must track the given radius.
    expect(dist).toBeCloseTo(expected, 3)

    controls.dispose()
  })

  it('scales framing distance proportionally to radius (10x radius => ~10x distance)', () => {
    const a = setup()
    fitCameraToObject(a.camera, a.controls, CENTER, RADIUS)
    const distSmall = a.camera.position.distanceTo(a.controls.target)

    const b = setup()
    fitCameraToObject(b.camera, b.controls, CENTER, RADIUS * 10)
    const distLarge = b.camera.position.distanceTo(b.controls.target)

    expect(distLarge / distSmall).toBeCloseTo(10, 3)

    a.controls.dispose()
    b.controls.dispose()
  })
})
