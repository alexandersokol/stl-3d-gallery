// Procedural matcap textures for the 'solidview', 'studio' and 'ceramic'
// material presets.
//
// Rather than shipping binary matcap image assets, we draw a simple lit-sphere
// radial gradient to a canvas at runtime and wrap it in a THREE.CanvasTexture.
// This keeps the app fully offline/asset-free while still giving the clay and
// ceramic presets a distinct, believable studio-lit look.

import * as THREE from 'three'

// The material presets whose look is a baked matcap texture (as opposed to the
// lit MeshStandardMaterial presets). Single source of truth for the shape of
// the matcap texture set, so makeMaterial / SceneManager / thumbnailer all
// stay in lockstep when a matcap preset is added.
export type MatcapName = 'solidview' | 'studio' | 'ceramic' | 'comic'

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
export function makeMatcaps(): Record<MatcapName, THREE.Texture> {
  // Solid View: Blender "solid mode" look — a strictly NEUTRAL matte grey
  // (r≈g≈b, no cool/lavender tint) and darker overall, with the darkest
  // shadows of the matcap presets (deeper than Studio). Soft grey highlight
  // (no specular hotspot, so it reads matte), a mid grey body, and a strong
  // fall-off to near-black at the silhouette for a heavy ambient-occlusion
  // feel.
  const solidviewCanvas = drawMatcap(
    [
      [0, '#bcbcbe'],
      [0.4, '#898a8c'],
      [0.72, '#48494c'],
      [1, '#161719'],
    ],
    '#131315',
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

  // Comic: the FLAT-COLOR fill of a cel-shaded / comic-book look. Instead of a
  // smooth gradient the stops are HARD steps (each color offset is duplicated
  // so the canvas gradient jumps rather than blends), giving crisp posterized
  // tone bands — highlight, mid, shadow — like the flats in ink-and-color
  // comic art. High contrast between bands so the cel banding reads clearly.
  // The bold black CONTOUR ("lines like in comics") is NOT drawn here — it's a
  // separate inverted-hull outline mesh (see makeOutlineMaterial / SceneManager
  // setComicOutline), which gives a clean uniform line the matcap rim can't.
  const comicCanvas = drawMatcap(
    [
      [0, '#f4f4f6'],
      [0.42, '#f4f4f6'], // highlight band — flat
      [0.42, '#aeb0b7'],
      [0.68, '#aeb0b7'], // mid band — flat
      [0.68, '#5f616a'],
      [0.9, '#5f616a'], // shadow band — flat
      [0.9, '#33343a'],
      [1, '#33343a'], // darkest edge band
    ],
    '#33343a',
  )

  return {
    solidview: toTexture(solidviewCanvas),
    studio: toTexture(studioCanvas),
    ceramic: toTexture(ceramicCanvas),
    comic: toTexture(comicCanvas),
  }
}
