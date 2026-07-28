import { describe, it, expect } from 'vitest'
import { repairMesh } from './mesh-repair'
import { analyzeMesh } from './mesh-analysis'
import type { RepairOptions } from '../../shared/types'

function soup(verts: number[][], faces: number[][]): Float32Array {
  const out: number[] = []
  for (const [a, b, c] of faces) {
    for (const i of [a, b, c]) out.push(verts[i][0], verts[i][1], verts[i][2])
  }
  return Float32Array.from(out)
}

function opts(partial: Partial<RepairOptions>): RepairOptions {
  return { weld: false, clean: false, fillHoles: false, fullManifold: false, ...partial }
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

describe('repairMesh', () => {
  it('is a no-op copy when no option is selected', () => {
    const input = soup(TETRA_VERTS, TETRA_FACES)
    const out = repairMesh(input, opts({}))
    expect(Array.from(out)).toEqual(Array.from(input))
    expect(out).not.toBe(input) // a copy, not the same reference
  })

  it('clean removes degenerate triangles', () => {
    const withDegenerate = soup([...TETRA_VERTS], [...TETRA_FACES, [1, 1, 2]])
    const out = repairMesh(withDegenerate, opts({ clean: true }))
    const a = analyzeMesh(out)
    expect(a.degenerateTriangles).toBe(0)
    expect(a.triCount).toBe(4)
  })

  it('clean removes exact duplicate triangles', () => {
    const doubled = soup([...TETRA_VERTS], [...TETRA_FACES, TETRA_FACES[0]])
    const out = repairMesh(doubled, opts({ weld: true, clean: true }))
    expect(analyzeMesh(out).triCount).toBe(4)
  })

  it('fillHoles closes an open mesh into a watertight one', () => {
    const open = soup(TETRA_VERTS, TETRA_FACES.slice(0, 3)) // one triangular hole
    expect(analyzeMesh(open).watertight).toBe(false)
    const out = repairMesh(open, opts({ weld: true, fillHoles: true }))
    const a = analyzeMesh(out)
    expect(a.watertight).toBe(true)
    expect(a.boundaryEdges).toBe(0)
  })

  it('fullManifold eliminates non-manifold edges', () => {
    const verts = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, -1, 0],
    ]
    const faces = [
      [0, 1, 2],
      [0, 1, 3],
      [0, 1, 4],
    ]
    const nonManifold = soup(verts, faces)
    expect(analyzeMesh(nonManifold).nonManifoldEdges).toBe(1)
    const out = repairMesh(nonManifold, opts({ weld: true, fullManifold: true }))
    expect(analyzeMesh(out).nonManifoldEdges).toBe(0)
  })
})
