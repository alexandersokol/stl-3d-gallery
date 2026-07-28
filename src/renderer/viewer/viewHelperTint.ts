// Recolors the three NEGATIVE-axis balls of three.js's corner ViewHelper gizmo.
//
// Stock ViewHelper draws the positive axes (+X/+Y/+Z) in bright red/green/blue
// but paints all three negative axes (-X/-Y/-Z) with a single shared BLACK
// sprite at 0.2 opacity. On this app's dark grey viewport that reads as three
// barely-visible grey balls. We repaint just those three sprites with a muted
// ("greyed") tint of their own axis colour so they read as greyed red / green
// / blue while staying clearly dimmer than the bright positive balls. The
// positive axes are left exactly as three.js draws them.

import * as THREE from 'three'

// Desaturated tints of ViewHelper's positive-axis colours (#ff4466 / #88ff44 /
// #4488ff), keyed by the gizmo's per-sprite `userData.type`.
const NEGATIVE_AXIS_TINTS: Record<string, string> = {
  negX: '#b45d68', // greyed red
  negY: '#7fae5f', // greyed green
  negZ: '#5f83b8', // greyed blue
}

// Matches getSpriteMaterial() inside ViewHelper.js: a filled circle of this
// radius on a 64x64 canvas, so the repainted negatives keep the same size and
// shape as the positive balls.
const SPRITE_CANVAS = 64
const SPRITE_RADIUS = 14

function makeDotSpriteMaterial(color: string): THREE.SpriteMaterial {
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_CANVAS
  canvas.height = SPRITE_CANVAS
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('viewHelperTint: failed to acquire 2d context')

  const c = SPRITE_CANVAS / 2
  ctx.beginPath()
  ctx.arc(c, c, SPRITE_RADIUS, 0, 2 * Math.PI)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  // Full opacity (stock negatives are 0.2) — the muted colour alone provides
  // the recede from the bright positives, without fading into the background.
  return new THREE.SpriteMaterial({ map: texture, toneMapped: false })
}

// Walks a ViewHelper (or any Object3D root) and swaps the material of each
// negative-axis sprite for a muted-colour dot. Disposing the sprite's previous
// material+map is safe even though the three negatives share one in stock
// ViewHelper (three.js dispose() is idempotent).
export function tintNegativeAxisSprites(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const type = obj.userData?.type as string | undefined
    if (!type || !(type in NEGATIVE_AXIS_TINTS)) return
    const sprite = obj as THREE.Sprite
    const prev = sprite.material as THREE.SpriteMaterial
    prev.map?.dispose()
    prev.dispose()
    sprite.material = makeDotSpriteMaterial(NEGATIVE_AXIS_TINTS[type])
  })
}
