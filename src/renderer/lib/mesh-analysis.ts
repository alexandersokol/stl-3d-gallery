// PURE mesh analysis: reports 3D-printability issues for an STL's raw triangle
// soup, the way Blender's 3D-print toolbox does. No three.js / DOM / fs.
//
// Welds coincident vertices first (see mesh-topology) so edge topology is
// meaningful, then classifies every undirected edge by how many triangles use
// it: 1 = boundary (a hole / open surface), 2 = manifold, >=3 = non-manifold.
// A mesh is watertight iff it has no boundary and no non-manifold edges.

import type { MeshAnalysis } from '../../shared/types'
import { weldVertices, undirectedEdgeKey, isDegenerateTriangle } from './mesh-topology'

export function analyzeMesh(positions: Float32Array): MeshAnalysis {
  const soupVertCount = Math.floor(positions.length / 3)
  const { positions: verts, indices, tol } = weldVertices(positions)
  const uniqueVertCount = verts.length / 3

  let degenerateTriangles = 0
  const edgeUse = new Map<number, number>()
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i],
      b = indices[i + 1],
      c = indices[i + 2]
    if (isDegenerateTriangle(verts, a, b, c, tol)) {
      degenerateTriangles++
      continue // degenerate faces carry no real edges — don't skew edge counts
    }
    bumpEdge(edgeUse, a, b)
    bumpEdge(edgeUse, b, c)
    bumpEdge(edgeUse, c, a)
  }

  let boundaryEdges = 0
  let nonManifoldEdges = 0
  for (const count of edgeUse.values()) {
    if (count === 1) boundaryEdges++
    else if (count >= 3) nonManifoldEdges++
  }

  return {
    triCount: Math.floor(indices.length / 3),
    vertCount: uniqueVertCount,
    // Coincident vertex instances that welded away. Nonzero for every healthy
    // STL (soup always has triCount*3 vertices), so it's neutral info, not an
    // error, and deliberately excluded from `watertight`.
    duplicateVertices: soupVertCount - uniqueVertCount,
    boundaryEdges,
    nonManifoldEdges,
    degenerateTriangles,
    watertight: boundaryEdges === 0 && nonManifoldEdges === 0,
  }
}

function bumpEdge(m: Map<number, number>, a: number, b: number): void {
  const key = undirectedEdgeKey(a, b)
  m.set(key, (m.get(key) ?? 0) + 1)
}
