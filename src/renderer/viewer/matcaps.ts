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
  // Solid View: Blender "solid mode" look — a neutral matte grey clay. Soft
  // light-grey highlight (no bright specular hotspot, so it reads matte), a
  // mid grey body, gentle darkening toward the silhouette for a soft
  // ambient-occlusion feel. The 3D-preview default material.
  const solidviewCanvas = drawMatcap(
    [
      [0, '#d3d4d7'],
      [0.4, '#b7b8bc'],
      [0.72, '#8b8d94'],
      [1, '#53555d'],
    ],
    '#484a52',
  )

  // Studio: the dedicated thumbnail-renderer look — a smooth lavender "studio
  // clay". Soft light-lavender highlight (kept matte — no near-white specular
  // hotspot), a lavender-grey body, then a deep cool purple-blue silhouette
  // edge, over a dark purple background (visible only at the sphere's very
  // rim). Tuned to match the reference thumbnails.
  const studioCanvas = drawMatcap(
    [
      [0, '#dcd7ee'],
      [0.4, '#b8b1d2'],
      [0.72, '#8a83ac'],
      [1, '#3f3b58'],
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
    solidview: toTexture(solidviewCanvas),
    studio: toTexture(studioCanvas),
    ceramic: toTexture(ceramicCanvas),
  }
}
