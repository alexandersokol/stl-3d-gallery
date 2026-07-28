// Procedural matcap textures for the 'studio' and 'ceramic' material presets.
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

  // Radial gradient centered slightly up-left of the canvas center, mimicking
  // a key light hitting a sphere from the upper-left — the classic matcap
  // "shiny ball" look.
  const cx = SIZE * 0.4
  const cy = SIZE * 0.38
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
 * Builds the 'studio' and 'ceramic' matcap textures used by MeshMatcapMaterial
 * in makeMaterial(). Cheap enough to call once (e.g. in SceneManager's
 * constructor) and reuse for the lifetime of the app.
 *
 * Because a matcap bakes its lighting/shadow/color into the texture and
 * ignores the scene's lights and environment, the 'studio' preset renders
 * pixel-identically in the offscreen thumbnailer and the live 3D preview —
 * the whole reason it exists (it's the default thumbnail-renderer preset).
 */
export function makeMatcaps(): { studio: THREE.Texture; ceramic: THREE.Texture } {
  // Studio: the dedicated thumbnail-renderer look — a smooth lavender "studio
  // clay". Cool near-white highlight upper-left, a light lavender-grey body,
  // a mid lavender-grey, then a deep cool purple-blue silhouette edge, over a
  // dark purple background (visible only at the sphere's very rim). Tuned to
  // match the reference thumbnails.
  const studioCanvas = drawMatcap(
    [
      [0, '#eeecf6'],
      [0.3, '#c9c4dd'],
      [0.6, '#948dba'],
      [0.82, '#5f5985'],
      [1, '#332f4c'],
    ],
    '#2a2740',
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
    studio: toTexture(studioCanvas),
    ceramic: toTexture(ceramicCanvas),
  }
}
