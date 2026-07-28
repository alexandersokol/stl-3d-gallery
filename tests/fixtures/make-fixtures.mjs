import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

// 8 corners of an axis-aligned unit cube spanning (0,0,0) .. (1,1,1).
const C = [
  [0, 0, 0], // 0
  [1, 0, 0], // 1
  [1, 1, 0], // 2
  [0, 1, 0], // 3
  [0, 0, 1], // 4
  [1, 0, 1], // 5
  [1, 1, 1], // 6
  [0, 1, 1], // 7
]

// 6 faces of the cube, each a quad of corner indices in CCW order as
// viewed from outside the cube (winding doesn't affect bbox/triCount,
// but keeping it consistent/outward is good practice for a real mesh).
const FACES = [
  [0, 3, 2, 1], // bottom  z=0, normal -z
  [4, 5, 6, 7], // top     z=1, normal +z
  [0, 1, 5, 4], // front   y=0, normal -y
  [3, 7, 6, 2], // back    y=1, normal +y
  [0, 4, 7, 3], // left    x=0, normal -x
  [1, 2, 6, 5], // right   x=1, normal +x
]

// Split each quad face into 2 triangles -> 6 faces * 2 = 12 triangles.
// Each triangle is flattened to 9 numbers: [ax,ay,az, bx,by,bz, cx,cy,cz].
const tris = FACES.flatMap(([a, b, c, d]) => [
  [...C[a], ...C[b], ...C[c]],
  [...C[a], ...C[c], ...C[d]],
])

if (tris.length !== 12) {
  throw new Error(`expected 12 triangles, got ${tris.length}`)
}

function bin(tris) {
  const buf = Buffer.alloc(84 + tris.length * 50)
  buf.writeUInt32LE(tris.length, 80)
  let o = 84
  for (const t of tris) {
    o += 12 // normal (zeroed)
    for (const v of t) {
      buf.writeFloatLE(v, o)
      o += 4
    }
    o += 2 // attribute byte count
  }
  return buf
}
function ascii(tris) {
  let s = 'solid cube\n'
  for (const t of tris) {
    s += ' facet normal 0 0 0\n  outer loop\n'
    for (let i = 0; i < 9; i += 3) s += `   vertex ${t[i]} ${t[i + 1]} ${t[i + 2]}\n`
    s += '  endloop\n endfacet\n'
  }
  return s + 'endsolid cube\n'
}
const here = dirname(new URL(import.meta.url).pathname)
writeFileSync(join(here, 'cube-bin.stl'), bin(tris))
writeFileSync(join(here, 'cube-ascii.stl'), ascii(tris))
mkdirSync(join(here, 'tree/sub'), { recursive: true })
writeFileSync(join(here, 'tree/a.stl'), bin(tris))
writeFileSync(join(here, 'tree/sub/b.stl'), bin(tris))

console.log('Fixtures written to', here)
