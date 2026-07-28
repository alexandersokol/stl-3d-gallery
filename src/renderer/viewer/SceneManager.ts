// Imperative three.js viewer engine. Owns the renderer/scene/camera/controls
// for a single <canvas> and exposes a small, React-friendly API (setModel,
// setMaterial, setLighting, ...) that the Viewer component drives from
// effects. Nothing here is React-aware; all state lives on the instance.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { fitCameraToObject } from './cameraControls'
import { makeMaterial, DEFAULT_BASE_COLOR, type MaterialPreset } from './materials'
import { makeLights, type LightPreset } from './lighting'
import { makeMatcaps } from './matcaps'

const BACKGROUND_LIGHT = 0xf2f3f5
const BACKGROUND_DARK = 0x1a1b1e

// Default grid extent/position used before any model has been loaded.
const DEFAULT_GRID_RADIUS = 5
const GRID_DIVISIONS = 20

export class SceneManager {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly envMap: THREE.Texture
  private readonly matcaps: { clay: THREE.Texture; ceramic: THREE.Texture }

  private mesh: THREE.Mesh | null = null
  private geometry: THREE.BufferGeometry | null = null
  private material: THREE.Material | null = null
  private lights: THREE.Light[] = []
  private gridHelper: THREE.GridHelper | null = null

  private materialPreset: MaterialPreset = 'matte'
  private baseColor = DEFAULT_BASE_COLOR
  private lightPreset: LightPreset = 'studio'
  private lightIntensity = 1
  private gridOn = false

  private rafId: number | null = null
  private disposed = false

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    const width = canvas.clientWidth || 300
    const height = canvas.clientHeight || 150
    this.renderer.setSize(width, height, false)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(BACKGROUND_DARK)

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000)
    // STL files use the Z-up convention (Blender / 3D-printing); orient the
    // camera's up-vector to +Z so OrbitControls orbits around a vertical Z
    // axis and models stand upright instead of appearing tipped onto their
    // back. See cameraControls.ts for the shared framing logic.
    this.camera.up.set(0, 0, 1)
    this.camera.position.set(3, 3, 3)
    this.camera.lookAt(0, 0, 0)

    // Procedural studio environment for image-based lighting (reflections on
    // glossy/metal presets). Built once via PMREMGenerator; the generator
    // itself is disposed immediately after use, only the resulting env
    // texture is kept.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    this.scene.environment = this.envMap

    this.matcaps = makeMatcaps()

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.target.set(0, 0, 0)
    this.controls.update()

    this.lights = makeLights(this.lightPreset, this.lightIntensity)
    for (const light of this.lights) this.scene.add(light)

    this.gridHelper = this.buildGridHelper(DEFAULT_GRID_RADIUS, 0)
    this.scene.add(this.gridHelper)

    this.animate()
  }

  private buildGridHelper(radius: number, y: number): THREE.GridHelper {
    const size = Math.max(radius * 4, 2)
    const helper = new THREE.GridHelper(size, GRID_DIVISIONS)
    helper.position.y = y
    helper.visible = this.gridOn
    return helper
  }

  private disposeGridHelper(): void {
    if (!this.gridHelper) return
    this.scene.remove(this.gridHelper)
    this.gridHelper.geometry.dispose()
    const materials = Array.isArray(this.gridHelper.material) ? this.gridHelper.material : [this.gridHelper.material]
    for (const m of materials) m.dispose()
    this.gridHelper = null
  }

  private disposeCurrentMesh(): void {
    if (this.mesh) this.scene.remove(this.mesh)
    this.geometry?.dispose()
    this.material?.dispose()
    this.geometry = null
    this.material = null
    this.mesh = null
  }

  private animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  setModel(positions: Float32Array): void {
    this.disposeCurrentMesh()

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    const material = makeMaterial(this.materialPreset, this.baseColor, this.matcaps)
    const mesh = new THREE.Mesh(geometry, material)
    this.scene.add(mesh)

    this.geometry = geometry
    this.material = material
    this.mesh = mesh

    const box = new THREE.Box3().setFromObject(mesh)
    const sphere = box.isEmpty() ? new THREE.Sphere(new THREE.Vector3(), 1) : box.getBoundingSphere(new THREE.Sphere())

    this.disposeGridHelper()
    this.gridHelper = this.buildGridHelper(sphere.radius, box.isEmpty() ? 0 : box.min.y)
    this.scene.add(this.gridHelper)

    fitCameraToObject(this.camera, mesh, this.controls)
  }

  setMaterial(preset: MaterialPreset, baseColor: string): void {
    this.materialPreset = preset
    this.baseColor = baseColor
    if (!this.mesh) return

    const material = makeMaterial(preset, baseColor, this.matcaps)
    this.material?.dispose()
    this.mesh.material = material
    this.material = material
  }

  setLighting(preset: LightPreset, intensity: number): void {
    this.lightPreset = preset
    this.lightIntensity = intensity

    for (const light of this.lights) this.scene.remove(light)
    this.lights = makeLights(preset, intensity)
    for (const light of this.lights) this.scene.add(light)
  }

  setBackground(mode: 'light' | 'dark'): void {
    this.scene.background = new THREE.Color(mode === 'light' ? BACKGROUND_LIGHT : BACKGROUND_DARK)
  }

  setGrid(on: boolean): void {
    this.gridOn = on
    if (this.gridHelper) this.gridHelper.visible = on
  }

  setAutoRotate(on: boolean): void {
    this.controls.autoRotate = on
  }

  resetCamera(): void {
    if (this.mesh) {
      fitCameraToObject(this.camera, this.mesh, this.controls)
      return
    }
    this.camera.position.set(3, 3, 3)
    this.camera.near = 0.01
    this.camera.far = 1000
    this.camera.updateProjectionMatrix()
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true

    if (this.rafId != null) cancelAnimationFrame(this.rafId)

    this.disposeCurrentMesh()

    for (const light of this.lights) this.scene.remove(light)
    this.lights = []

    this.disposeGridHelper()

    // Removes the DOM (pointer/wheel/keyboard) listeners OrbitControls
    // attached to the canvas.
    this.controls.dispose()

    this.envMap.dispose()
    this.matcaps.clay.dispose()
    this.matcaps.ceramic.dispose()

    this.renderer.dispose()
  }
}
