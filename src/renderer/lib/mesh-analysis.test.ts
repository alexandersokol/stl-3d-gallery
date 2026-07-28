import { describe, it, expect } from 'vitest'
import { analyzeMesh } from './mesh-analysis'

function soup(verts: number[][], faces: number[][]): Float32Array {
  const out: number[] = []
  for (const [a, b, c] of faces) {
    for (const i of [a, b, c]) out.push(verts[i][0], verts[i][1], verts[i][2])
  }
  return Float32Array.from(out)
}

const TETRA_VERTS = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
]
const TETRA_FACES = [
  [0, 2, 1],
  [0, 1, 3],
  [0, 3, 2],
  [1, 2, 3],
]

describe('analyzeMesh', () => {
  it('reports a closed tetrahedron as watertight with no issues', () => {
    const a = analyzeMesh(soup(TETRA_VERTS, TETRA_FACES))
    expect(a.watertight).toBe(true)
    expect(a.boundaryEdges).toBe(0)
    expect(a.nonManifoldEdges).toBe(0)
    expect(a.degenerateTriangles).toBe(0)
    expect(a.triCount).toBe(4)
    expect(a.vertCount).toBe(4)
    // 12 soup vertices welded to 4 unique.
    expect(a.duplicateVertices).toBe(8)
  })

  it('reports boundary edges (holes) when a face is missing', () => {
    const open = soup(TETRA_VERTS, TETRA_FACES.slice(0, 3)) // drop [1,2,3]
    const a = analyzeMesh(open)
    expect(a.watertight).toBe(false)
    expect(a.boundaryEdges).toBe(3)
    expect(a.nonManifoldEdges).toBe(0)
  })

  it('reports non-manifold edges when an edge is shared by 3 faces', () => {
    const verts = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, -1, 0],
    ]
    // Edge 0-1 is shared by three triangles.
    const faces = [
      [0, 1, 2],
      [0, 1, 3],
      [0, 1, 4],
    ]
    const a = analyzeMesh(soup(verts, faces))
    expect(a.nonManifoldEdges).toBe(1)
    expect(a.watertight).toBe(false)
  })

  it('counts degenerate triangles without letting them skew edge counts', () => {
    // Closed tetra plus one zero-area triangle (two coincident corners).
    const withDegenerate = soup(
      [...TETRA_VERTS],
      [...TETRA_FACES, [1, 1, 2]], // vertices 1 and 1 coincide → degenerate
    )
    const a = analyzeMesh(withDegenerate)
    expect(a.degenerateTriangles).toBe(1)
    // The tetra underneath is still closed.
    expect(a.watertight).toBe(true)
    expect(a.boundaryEdges).toBe(0)
  })

  it('handles an empty mesh gracefully', () => {
    const a = analyzeMesh(new Float32Array(0))
    expect(a.triCount).toBe(0)
    expect(a.watertight).toBe(true)
  })
})
