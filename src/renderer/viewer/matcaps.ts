// Procedural matcap textures for the 'solidview', 'studio' and 'ceramic'
// material presets.
//
// Rather than shipping binary matcap image assets, we draw a simple lit-sphere
// radial gradient to a canvas at runtime and wrap it in a THREE.CanvasTexture.
// This keeps the app fully offline/asset-free while still giving the clay and
// ceramic presets a distinct, believable studio-lit look.

import * as THREE from 'three'

const SIZE = 256

function drawMatcap(stops: Array<[number, string]>, bg: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('matcaps: failed to acquire 2d context')

  // Background fill first (visible at the sphere's silhouette edge, since the
  // gradient below is circular but the canvas is square).
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SIZE, SIZE)

  // Radial gradient centered near the canvas center (nudged only slightly
  // above it). In matcap space the texture center maps to surface normals
  // facing the camera, so keeping the highlight there makes the light read as
  // coming from the FRONT (a touch above), lighting the model's camera-facing
  // surfaces — rather than from the top/behind, which a strongly off-center
  // (e.g. upper-left) highlight produces.
  const cx = SIZE * 0.5
  const cy = SIZE * 0.44
  const gradient = ctx.createRadialGradient(cx, cy, 0, SIZE * 0.5, SIZE * 0.5, SIZE * 0.72)
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color)
  }

  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(SIZE * 0.5, SIZE * 0.5, SIZE * 0.5, 0, Math.PI * 2)
  ctx.fill()

  return canvas
}

function toTexture(canvas: HTMLCanvasElement): THREE.Texture {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * Builds the 'solidview', 'studio' and 'ceramic' matcap textures used by
 * MeshMatcapMaterial in makeMaterial(). Cheap enough to call once (e.g. in
 * SceneManager's constructor) and reuse for the lifetime of the app.
 *
 * Because a matcap bakes its lighting/shadow/color into the texture and
 * ignores the scene's lights and environment, these presets render
 * pixel-identically in the offscreen thumbnailer and the live 3D preview.
 * 'studio' is the default thumbnail-renderer preset; 'solidview' is the
 * default 3D-preview material.
 */
export function makeMatcaps(): {
  solidview: THREE.Texture
  studio: THREE.Texture
  ceramic: THREE.Texture
} {
  // Solid View: Blender "solid mode" look — a neutral matte grey clay, a bit
  // darker overall with darker shadows (but not as dark as Studio). Soft
  // light-grey highlight (no bright specular hotspot, so it reads matte), a
  // mid grey body, strong darkening toward the silhouette for a soft
  // ambient-occlusion feel. The 3D-preview default material.
  const solidviewCanvas = drawMatcap(
    [
      [0, '#c9cacd'],
      [0.4, '#a4a5aa'],
      [0.72, '#727479'],
      [1, '#3d3f46'],
    ],
    '#3a3c42',
  )

  // Studio: the dedicated thumbnail-renderer look — a matte "studio clay".
  // Predominantly neutral grey with just a whisper of cool lavender (blue a
  // touch above red/green), and the darkest shadows of the matcap presets.
  // Soft light highlight (matte, no near-white specular hotspot) fading to a
  // deep near-black cool grey at the silhouette. Tuned to the reference thumbs.
  const studioCanvas = drawMatcap(
    [
      [0, '#d5d5de'],
      [0.4, '#a4a4b2'],
      [0.72, '#666675'],
      [1, '#2c2c39'],
    ],
    '#24242e',
  )

  // Ceramic: brighter, cooler studio look — crisp near-white highlight, light
  // neutral body, subtle cool falloff toward the edge (glazed porcelain).
  const ceramicCanvas = drawMatcap(
    [
      [0, '#ffffff'],
      [0.3, '#eef1f4'],
      [0.65, '#c7ccd3'],
      [1, '#8b909a'],
    ],
    '#71767f',
  )

  return {
    solidview: toTexture(solidviewCanvas),
    studio: toTexture(studioCanvas),
    ceramic: toTexture(ceramicCanvas),
  }
}
