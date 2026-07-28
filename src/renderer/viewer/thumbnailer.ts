// Offscreen three.js renderer that turns parsed STL geometry into a square
// PNG thumbnail. Runs entirely off the DOM (OffscreenCanvas where available)
// so it can be driven from a plain async call — no <canvas> needs to be
// mounted anywhere.
//
// The WebGLRenderer + PMREM-generated environment map are expensive to set
// up (shader compilation, env map convolution) so they're built once, lazily,
// and reused across calls via module-level singletons. Geometry and material
// are cheap and per-model, so those are created and disposed on every call to
// avoid leaking GPU buffers.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const DEFAULT_SIZE = 256
const BACKGROUND_FILL_FRACTION = 0.85 // model should fill ~85% of the frame

type RenderTarget = OffscreenCanvas | HTMLCanvasElement

interface RendererState {
  renderer: THREE.WebGLRenderer
  canvas: RenderTarget
  envMap: THREE.Texture
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
}

let state: RendererState | null = null

function createCanvas(size: number): RenderTarget {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size, size)
  }
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  return canvas
}

// Lazily builds (once) and returns the shared renderer/scene/env-map used by
// every renderThumbnail() call. Do not construct a new WebGLRenderer per
// call — context creation and shader/PMREM compilation are the expensive
// part of this module.
function getState(): RendererState {
  if (state) return state

  const canvas = createCanvas(DEFAULT_SIZE)
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  })
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new RoomEnvironment()
  const envMap = pmrem.fromScene(envScene, 0.04).texture
  pmrem.dispose()

  const scene = new THREE.Scene()
  scene.environment = envMap

  const hemi = new THREE.HemisphereLight(0xffffff, 0x777788, 1.0)
  scene.add(hemi)

  const key = new THREE.DirectionalLight(0xffffff, 1.2)
  key.position.set(1, 1.2, 1)
  scene.add(key)

  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100)
  // STL files use the Z-up convention (Blender / 3D-printing). Match the
  // live viewer's camera orientation (see cameraControls.ts) so a model's
  // thumbnail shows it standing upright, the same way it appears when
  // opened in the viewer.
  camera.up.set(0, 0, 1)

  state = { renderer, canvas, envMap, scene, camera }
  return state
}

function toBlob(canvas: RenderTarget): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/png' })
  }
  return new Promise((resolve, reject) => {
    ;(canvas as HTMLCanvasElement).toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('thumbnailer: canvas.toBlob() returned null'))
    }, 'image/png')
  })
}

/**
 * Renders raw triangle-soup vertex positions (as produced by loadModel) to a
 * square, transparent-background PNG thumbnail on a shared offscreen
 * WebGL context.
 *
 * The actual render body (doRenderThumbnail) mutates module-level shared
 * state (scene/camera/canvas) and awaits an async toBlob() call partway
 * through. If two renders were allowed to run concurrently, the second call
 * would mutate that shared state during the first call's async gap,
 * producing corrupted thumbnails (composited meshes, wrong camera). To
 * prevent that, every call to renderThumbnail is chained onto a
 * module-level FIFO queue so renders are strictly serialized — each call
 * waits for the previous one to fully settle (including its async toBlob)
 * before starting.
 */
async function doRenderThumbnail(positions: Float32Array, size = DEFAULT_SIZE): Promise<Blob> {
  const { renderer, canvas, scene, camera } = getState()

  renderer.setSize(size, size, false)
  camera.aspect = 1

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()

  const material = new THREE.MeshStandardMaterial({
    color: 0xb0b6be,
    roughness: 0.85,
    metalness: 0.0,
  })

  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)

  try {
    const sphere = geometry.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), 1)
    const center = sphere.center
    const radius = sphere.radius > 0 ? sphere.radius : 1

    // Fixed pleasant 3/4 view in Z-up space (+X right, -Y toward the
    // viewer/front, +Z up) — the SAME direction used by cameraControls.ts's
    // fitCameraToObject, so a model's thumbnail matches its orientation in
    // the live viewer. Offset along this direction from the model center,
    // then pull back until the bounding sphere fits within
    // BACKGROUND_FILL_FRACTION of the vertical frame.
    const dir = new THREE.Vector3(1, -1, 0.75).normalize()
    const vFov = (camera.fov * Math.PI) / 180
    const distanceForFit = radius / (Math.sin(vFov / 2) * BACKGROUND_FILL_FRACTION)

    camera.position.copy(center).addScaledVector(dir, distanceForFit)
    camera.near = Math.max(distanceForFit - radius * 2, 0.01)
    camera.far = distanceForFit + radius * 2
    camera.lookAt(center)
    camera.updateProjectionMatrix()

    renderer.render(scene, camera)

    return await toBlob(canvas)
  } finally {
    scene.remove(mesh)
    geometry.dispose()
    material.dispose()
  }
}

// Module-level FIFO queue serializing all renderThumbnail() calls. See the
// doc comment above for why this is necessary.
let renderQueue: Promise<unknown> = Promise.resolve()

export function renderThumbnail(positions: Float32Array, size = DEFAULT_SIZE): Promise<Blob> {
  const result = renderQueue.then(() => doRenderThumbnail(positions, size))
  // Keep the chain alive even if a render rejects, so one failure doesn't
  // wedge the queue for subsequent calls. The returned `result` promise
  // still rejects to the caller.
  renderQueue = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
