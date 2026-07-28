// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { fitCameraToObject } from './cameraControls'

describe('fitCameraToObject (smoke)', () => {
  it('moves the camera to a finite, non-origin position and centers controls.target on the object', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
    const canvas = document.createElement('canvas')
    const controls = new OrbitControls(camera, canvas)

    const geometry = new THREE.BoxGeometry(2, 2, 2)
    geometry.translate(5, 1, -2)
    const mesh = new THREE.Mesh(geometry)

    fitCameraToObject(camera, mesh, controls)

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
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
    const canvas = document.createElement('canvas')
    const controls = new OrbitControls(camera, canvas)

    const geometry = new THREE.BoxGeometry(2, 2, 2)
    geometry.translate(5, 1, -2)
    const mesh = new THREE.Mesh(geometry)

    fitCameraToObject(camera, mesh, controls)

    expect(camera.up.x).toBe(0)
    expect(camera.up.y).toBe(0)
    expect(camera.up.z).toBe(1)

    controls.dispose()
  })

  it('centers controls.target on the object and positions the camera above it in Z', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000)
    const canvas = document.createElement('canvas')
    const controls = new OrbitControls(camera, canvas)

    const geometry = new THREE.BoxGeometry(2, 2, 2)
    geometry.translate(5, 1, -2)
    const mesh = new THREE.Mesh(geometry)

    fitCameraToObject(camera, mesh, controls)

    const center = new THREE.Vector3(5, 1, -2)
    expect(controls.target.x).toBeCloseTo(center.x, 5)
    expect(controls.target.y).toBeCloseTo(center.y, 5)
    expect(controls.target.z).toBeCloseTo(center.z, 5)

    // Z-up: the camera should sit above the model's center (higher Z),
    // viewing from the front-right (dir = (1, -1, 0.75).normalize()).
    expect(camera.position.z).toBeGreaterThan(center.z)
  })
})
