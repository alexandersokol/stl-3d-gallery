// Imperative three.js viewer engine. Owns the renderer/scene/camera/controls
// for a single <canvas> and exposes a small, React-friendly API (setModel,
// setMaterial, setLighting, ...) that the Viewer component drives from
// effects. Nothing here is React-aware; all state lives on the instance.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import { fitCameraToObject } from './cameraControls'
import { makeMaterial, makeOutlineMaterial, DEFAULT_BASE_COLOR, type MaterialPreset } from './materials'
import { makeLights, type LightPreset } from './lighting'
import { makeMatcaps, type MatcapName } from './matcaps'
import { tintNegativeAxisSprites } from './viewHelperTint'

// Radial-gradient background stops: lighter center (behind the model),
// gently darker toward the edges — a soft studio/vignette backdrop rather
// than a flat fill. Kept subtle (low contrast between center/mid/edge) so it
// reads as ambient studio light, not a spotlight.
const BACKGROUND_GRADIENT_DARK = { center: '#3c3f45', mid: '#2b2d31', edge: '#202225' }
const BACKGROUND_GRADIENT_LIGHT = { center: '#fbfbfc', mid: '#eaebed', edge: '#dcdee1' }
const BACKGROUND_TEXTURE_SIZE = 512

// Default grid extent/position used before any model has been loaded.
const DEFAULT_GRID_RADIUS = 5
const GRID_DIVISIONS = 20

/**
 * Renders a soft radial-gradient vignette to a square canvas: full center
 * color out to ~30% of the radius, fading through a midtone to the edge
 * color by 100%. Used as scene.background so the live viewer reads as a
 * studio backdrop instead of a flat fill.
 */
function makeBackgroundGradientTexture(stops: { center: string; mid: string; edge: string }): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = BACKGROUND_TEXTURE_SIZE
  canvas.height = BACKGROUND_TEXTURE_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('SceneManager: 2D context unavailable for background gradient')

  const cx = BACKGROUND_TEXTURE_SIZE / 2
  const cy = BACKGROUND_TEXTURE_SIZE / 2
  const outerR = BACKGROUND_TEXTURE_SIZE / 2

  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR)
  gradient.addColorStop(0, stops.center)
  gradient.addColorStop(0.3, stops.center)
  gradient.addColorStop(0.65, stops.mid)
  gradient.addColorStop(1, stops.edge)

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, BACKGROUND_TEXTURE_SIZE, BACKGROUND_TEXTURE_SIZE)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export class SceneManager {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly controls: OrbitControls
  private readonly viewHelper: ViewHelper
  private readonly clock: THREE.Clock
  private readonly envMap: THREE.Texture
  private readonly matcaps: Record<MatcapName, THREE.Texture>
  private readonly backgroundTextures: { dark: THREE.CanvasTexture; light: THREE.CanvasTexture }

  private mesh: THREE.Mesh | null = null
  private geometry: THREE.BufferGeometry | null = null
  private material: THREE.Material | null = null
  // The comic preset's inverted-hull ink outline: a black back-face shell that
  // shares the model geometry, added as a child of `mesh` (only while the comic
  // preset is active). Its own material is owned here; the shared geometry is
  // NOT disposed through it.
  private outlineMesh: THREE.Mesh | null = null
  private lights: THREE.Light[] = []
  private gridHelper: THREE.GridHelper | null = null
  // Farthest distance from the camera target (model center) to a corner of the
  // ground grid. The grid extends well past the model, so when it's visible the
  // clip planes must open up to include it or its far/near rows get cut off.
  private gridReach = 0

  private materialPreset: MaterialPreset = 'studio'
  private baseColor = DEFAULT_BASE_COLOR
  private lightPreset: LightPreset = 'studio'
  private lightIntensity = 1
  private gridOn = false

  // Bounding-sphere radius of the currently loaded model, used every frame
  // to keep the camera's near/far clip planes tight around the model (see
  // animate()) and to size OrbitControls' min/maxDistance for the current
  // camera-navigation mode (see applyCameraMode()). Null until a model has
  // been loaded; the render loop and applyCameraMode() fall back to 1.
  private modelRadius: number | null = null
  // Center of the current model's bounding sphere (world space). Used by
  // fitCameraToObject/resetCamera so framing is derived from the geometry's
  // own bounding sphere rather than a re-computed Box3 (the latter was
  // unreliable on the first large-mesh load).
  private modelCenter = new THREE.Vector3()
  // 'fly' (default): dolly all the way to/through the surface, for
  // fly-through/interior inspection. 'surface': stop just outside the
  // surface. Driven later by a Settings screen via setCameraMode().
  private cameraMode: 'fly' | 'surface' = 'fly'

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
    // Built once and cached; setBackground() just swaps which texture is
    // assigned to scene.background, so mode switches never re-render canvas
    // gradients on the hot path.
    this.backgroundTextures = {
      dark: makeBackgroundGradientTexture(BACKGROUND_GRADIENT_DARK),
      light: makeBackgroundGradientTexture(BACKGROUND_GRADIENT_LIGHT),
    }
    this.scene.background = this.backgroundTextures.dark

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
    this.applyCameraMode()
    this.controls.update()

    // Corner axis gizmo (Blender/Tripo-style): shows X/Y/Z and animates the
    // camera to look down an axis when clicked. It reads camera.up, so with
    // up=+Z (see above) it renders Z pointing up, matching the scene.
    this.viewHelper = new ViewHelper(this.camera, this.renderer.domElement)
    // Stock ViewHelper draws the -X/-Y/-Z balls in near-invisible grey on our
    // dark viewport; tint them muted red/green/blue so all six axes read.
    tintNegativeAxisSprites(this.viewHelper)
    this.viewHelper.center = this.controls.target
    this.clock = new THREE.Clock()
    this.renderer.domElement.addEventListener('pointerup', this.handleViewHelperPointerUp)

    this.lights = makeLights(this.lightPreset, this.lightIntensity)
    for (const light of this.lights) this.scene.add(light)

    this.gridHelper = this.buildGridHelper(DEFAULT_GRID_RADIUS, 0)
    this.scene.add(this.gridHelper)

    this.animate()
  }

  private buildGridHelper(radius: number, z: number): THREE.GridHelper {
    const size = Math.max(radius * 4, 2)
    const helper = new THREE.GridHelper(size, GRID_DIVISIONS)
    // GridHelper is built flat in the XZ plane (Y-up ground) by default.
    // The scene is Z-up (see camera.up above), so the "ground" is the XY
    // plane -- rotate +90 deg about X to lay the grid flat there, then seat
    // it at the model's base (min Z) so it reads as a floor under the model.
    helper.rotation.x = Math.PI / 2
    helper.position.z = z
    helper.visible = this.gridOn

    // Distance from the camera target (model center) to the farthest grid
    // corner, so the clip planes can grow to contain the grid (see animate()).
    // The grid is centered on X/Y at 0 and sits at z; the farthest corner is on
    // the opposite side of the center from any model-center offset.
    const half = size / 2
    this.gridReach = Math.hypot(
      half + Math.abs(this.modelCenter.x),
      half + Math.abs(this.modelCenter.y),
      this.modelCenter.z - z,
    )
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
    // Outline first: it's a child of `mesh` and shares `geometry`, so drop its
    // own material here (never the shared geometry) before the mesh goes.
    this.disposeOutline()
    if (this.mesh) this.scene.remove(this.mesh)
    this.geometry?.dispose()
    this.material?.dispose()
    this.geometry = null
    this.material = null
    this.mesh = null
  }

  private disposeOutline(): void {
    if (!this.outlineMesh) return
    this.outlineMesh.parent?.remove(this.outlineMesh)
    ;(this.outlineMesh.material as THREE.Material).dispose()
    this.outlineMesh = null
  }

  // Adds or removes the comic preset's inverted-hull ink outline to match
  // whether the comic material is active. The outline shares the current model
  // geometry and rides along as a child of the model mesh.
  private setComicOutline(enabled: boolean): void {
    if (enabled) {
      if (this.outlineMesh || !this.mesh || !this.geometry) return
      const thickness = (this.modelRadius || 1) * 0.02
      const outline = new THREE.Mesh(this.geometry, makeOutlineMaterial(thickness))
      this.outlineMesh = outline
      this.mesh.add(outline)
    } else {
      this.disposeOutline()
    }
  }

  private animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate)
    const delta = this.clock.getDelta()
    if (this.viewHelper.animating) this.viewHelper.update(delta)
    this.controls.update()

    // Keep the clip planes tight around the model at the CURRENT zoom
    // distance every frame, rather than relying on the fixed near/far set
    // once at fit time. A fixed far plane clips the model when zooming out
    // past it; a fixed near plane slices into the model (visible interior
    // cross-sections) when zooming/dollying in past it. Recomputing from
    // the live camera-to-target distance each frame guarantees the whole
    // model stays between the planes at any zoom level, including dollying
    // up to/through the surface in 'fly' mode.
    const dist = this.camera.position.distanceTo(this.controls.target)
    const r = this.modelRadius || 1
    // When the grid is visible, open the clip planes to include its full extent
    // (it reaches ~2.8x the model radius) so its near/far rows aren't cut off.
    // When it's hidden, keep them tight around the model for best depth
    // precision.
    const reach = this.gridOn ? this.gridReach : 0
    this.camera.near = Math.max(dist - Math.max(r * 1.1, reach), r * 0.002)
    this.camera.far = dist + Math.max(r * 1.5, reach)
    this.camera.updateProjectionMatrix()

    this.renderer.render(this.scene, this.camera)

    // ViewHelper draws itself as a second pass over the main render, using
    // its own small viewport in the corner; autoClear must be off so it
    // doesn't wipe the scene that was just rendered above.
    this.renderer.autoClear = false
    this.viewHelper.render(this.renderer)
    this.renderer.autoClear = true
  }

  // If the gizmo consumed the click it starts animating the camera itself;
  // there is nothing further for us to do. Clicks outside the gizmo's small
  // corner viewport fall through untouched, so OrbitControls dragging is
  // unaffected.
  private handleViewHelperPointerUp = (event: PointerEvent): void => {
    this.viewHelper.handleClick(event)
  }

  setModel(positions: Float32Array): void {
    this.disposeCurrentMesh()

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()

    // Frame from the geometry's own bounding sphere (reliable) rather than a
    // re-computed Box3 (which returned a wrong, tiny box on the first large
    // mesh, causing an extreme zoomed-in initial view).
    const bs = geometry.boundingSphere
    this.modelRadius = bs && bs.radius > 0 ? bs.radius : 1
    this.modelCenter.copy(bs ? bs.center : new THREE.Vector3())

    const material = makeMaterial(this.materialPreset, this.baseColor, this.matcaps)
    const mesh = new THREE.Mesh(geometry, material)
    this.scene.add(mesh)

    this.geometry = geometry
    this.material = material
    this.mesh = mesh
    this.setComicOutline(this.materialPreset === 'comic')

    const box = new THREE.Box3().setFromObject(mesh)
    const sphere = box.isEmpty() ? new THREE.Sphere(new THREE.Vector3(), 1) : box.getBoundingSphere(new THREE.Sphere())

    this.disposeGridHelper()
    this.gridHelper = this.buildGridHelper(sphere.radius, box.isEmpty() ? 0 : box.min.z)
    this.scene.add(this.gridHelper)

    // Re-derive OrbitControls min/maxDistance for the new model size BEFORE
    // fitting. fitCameraToObject calls controls.update(), which clamps the
    // camera distance to [minDistance, maxDistance]; if applyCameraMode ran
    // AFTER the fit, the first model would be clamped to the stale no-model
    // maxDistance (radius 1 * 50 = 50), snapping the camera far too close.
    this.applyCameraMode()
    fitCameraToObject(this.camera, this.controls, this.modelCenter, this.modelRadius)
  }

  /**
   * Sets the camera-navigation mode that a future Settings screen will
   * drive: 'fly' allows dollying all the way to/through the model surface
   * (fly-through / interior inspection), while 'surface' stops the camera
   * just outside the surface (classic zoom-to-surface behavior). Dynamic
   * near/far (see animate()) means neither mode ever clips the model.
   */
  setCameraMode(mode: 'fly' | 'surface'): void {
    this.cameraMode = mode
    this.applyCameraMode()
  }

  private applyCameraMode(): void {
    const r = this.modelRadius || 1
    this.controls.minDistance = this.cameraMode === 'fly' ? r * 0.01 : r * 1.05
    this.controls.maxDistance = r * 50
  }

  setMaterial(preset: MaterialPreset, baseColor: string): void {
    this.materialPreset = preset
    this.baseColor = baseColor
    if (!this.mesh) return

    const material = makeMaterial(preset, baseColor, this.matcaps)
    this.material?.dispose()
    this.mesh.material = material
    this.material = material
    this.setComicOutline(preset === 'comic')
  }

  setLighting(preset: LightPreset, intensity: number): void {
    this.lightPreset = preset
    this.lightIntensity = intensity

    for (const light of this.lights) this.scene.remove(light)
    this.lights = makeLights(preset, intensity)
    for (const light of this.lights) this.scene.add(light)
  }

  setBackground(mode: 'light' | 'dark'): void {
    this.scene.background = mode === 'light' ? this.backgroundTextures.light : this.backgroundTextures.dark
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
      fitCameraToObject(this.camera, this.controls, this.modelCenter, this.modelRadius ?? 1)
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

    this.renderer.domElement.removeEventListener('pointerup', this.handleViewHelperPointerUp)
    this.viewHelper.dispose()

    this.disposeCurrentMesh()

    for (const light of this.lights) this.scene.remove(light)
    this.lights = []

    this.disposeGridHelper()

    // Removes the DOM (pointer/wheel/keyboard) listeners OrbitControls
    // attached to the canvas.
    this.controls.dispose()

    this.envMap.dispose()
    this.matcaps.solidview.dispose()
    this.matcaps.studio.dispose()
    this.matcaps.ceramic.dispose()
    this.matcaps.comic.dispose()
    this.backgroundTextures.dark.dispose()
    this.backgroundTextures.light.dispose()

    this.renderer.dispose()
  }
}
