import { describe, it, expect } from 'vitest'
import { weldVertices, boundaryLoops, isDegenerateTriangle } from './mesh-topology'

// Builds triangle-soup positions (length = faces*9) from a unique vertex list
// and index triples — the inverse of what weldVertices reconstructs.
function soup(verts: number[][], faces: number[][]): Float32Array {
  const out: number[] = []
  for (const [a, b, c] of faces) {
    for (const i of [a, b, c]) out.push(verts[i][0], verts[i][1], verts[i][2])
  }
  return Float32Array.from(out)
}

const QUAD_VERTS = [
  [0, 0, 0],
  [1, 0, 0],
  [1, 1, 0],
  [0, 1, 0],
]
// Two triangles sharing the diagonal edge 0-2: 6 soup vertices, 4 unique.
const QUAD_FACES = [
  [0, 1, 2],
  [0, 2, 3],
]

describe('weldVertices', () => {
  it('merges coincident soup vertices into a shared index buffer', () => {
    const { positions, indices } = weldVertices(soup(QUAD_VERTS, QUAD_FACES))
    expect(positions.length / 3).toBe(4) // 4 unique vertices
    expect(indices.length).toBe(6) // 2 triangles
    expect(Array.from(indices)).toEqual([0, 1, 2, 0, 2, 3])
  })

  it('does not merge vertices that are genuinely apart', () => {
    const { positions } = weldVertices(soup(QUAD_VERTS, [[0, 1, 2]]))
    expect(positions.length / 3).toBe(3)
  })
})

describe('isDegenerateTriangle', () => {
  it('flags a triangle with two coincident corners', () => {
    const p = Float32Array.from([0, 0, 0, 1, 0, 0, 1, 0, 0])
    expect(isDegenerateTriangle(p, 0, 1, 2, 1e-4)).toBe(true)
  })
  it('accepts a real triangle', () => {
    const p = Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0])
    expect(isDegenerateTriangle(p, 0, 1, 2, 1e-4)).toBe(false)
  })
})

describe('boundaryLoops', () => {
  it('finds no loops on a closed quad', () => {
    const { indices } = weldVertices(soup(QUAD_VERTS, QUAD_FACES))
    // The quad is a flat open sheet — it has a 4-edge outer boundary.
    const loops = boundaryLoops(indices)
    expect(loops.length).toBe(1)
    expect(loops[0].length).toBe(4)
  })

  it('assembles the single 3-edge loop of an open tetrahedron', () => {
    const verts = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]
    // A tetrahedron missing its [1,2,3] face — one triangular hole.
    const faces = [
      [0, 2, 1],
      [0, 1, 3],
      [0, 3, 2],
    ]
    const { indices } = weldVertices(soup(verts, faces))
    const loops = boundaryLoops(indices)
    expect(loops.length).toBe(1)
    expect(loops[0].length).toBe(3)
  })
})
