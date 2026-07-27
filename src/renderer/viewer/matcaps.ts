// Procedural matcap textures for the 'clay' and 'ceramic' material presets.
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
 * Builds the 'clay' and 'ceramic' matcap textures used by MeshMatcapMaterial
 * in makeMaterial(). Cheap enough to call once (e.g. in SceneManager's
 * constructor) and reuse for the lifetime of the app.
 */
export function makeMatcaps(): { clay: THREE.Texture; ceramic: THREE.Texture } {
  // Clay: warm terracotta, soft muted highlight, darkening to a warm
  // greyish-brown edge — unglazed stoneware look.
  const clayCanvas = drawMatcap(
    [
      [0, '#e3b79a'],
      [0.35, '#c98f6b'],
      [0.7, '#9c6247'],
      [1, '#5c3a2c'],
    ],
    '#4a2f24',
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
    clay: toTexture(clayCanvas),
    ceramic: toTexture(ceramicCanvas),
  }
}
