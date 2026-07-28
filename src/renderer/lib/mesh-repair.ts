// PURE mesh repair: applies a selected set of fixes to an STL's raw triangle
// soup and returns repaired triangle soup ready to write back out. No three.js
// / DOM / fs.
//
// Passes run in a fixed order and compose. `fillHoles` and `fullManifold` need
// real edge topology, so they force welding internally even if the caller left
// the weld box unchecked. With no option selected this is a no-op copy.

import type { RepairOptions } from '../../shared/types'
import {
  weldVertices,
  weldTolerance,
  undirectedEdgeKey,
  isDegenerateTriangle,
  boundaryLoops,
  type IndexedMesh,
} from './mesh-topology'

export function repairMesh(positions: Float32Array, options: RepairOptions): Float32Array {
  const anySelected = options.weld || options.clean || options.fillHoles || options.fullManifold
  if (!anySelected) return positions.slice()

  const needsWeld = options.weld || options.fillHoles || options.fullManifold
  const mesh: IndexedMesh = needsWeld ? weldVertices(positions) : trivialIndexed(positions)

  let indices = mesh.indices
  if (options.clean) indices = dropBadTriangles(mesh.positions, indices, mesh.tol)
  if (options.fillHoles) indices = fillHoles(indices)
  if (options.fullManifold) indices = makeManifold(indices)

  return indexedToSoup(mesh.positions, indices)
}

// A 1:1 indexed view of the soup (no vertices merged) for the clean-only path,
// which must preserve the original coordinates exactly.
function trivialIndexed(positions: Float32Array): IndexedMesh {
  const vertCount = Math.floor(positions.length / 3)
  const indices = new Uint32Array(vertCount)
  for (let i = 0; i < vertCount; i++) indices[i] = i
  return { positions: positions.slice(), indices, tol: weldTolerance(positions) }
}

// clean: drop degenerate (zero-area) triangles and exact duplicate triangles
// (same three welded corners in any order — a common STL defect that also
// shows up as non-manifold edges).
function dropBadTriangles(positions: Float32Array, indices: Uint32Array, tol: number): Uint32Array {
  const seen = new Set<string>()
  const out: number[] = []
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i],
      b = indices[i + 1],
      c = indices[i + 2]
    if (isDegenerateTriangle(positions, a, b, c, tol)) continue
    const key = sortedTriKey(a, b, c)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a, b, c)
  }
  return Uint32Array.from(out)
}

// fillHoles: fan-triangulate every boundary loop shut.
function fillHoles(indices: Uint32Array): Uint32Array {
  const loops = boundaryLoops(indices)
  const extra: number[] = []
  for (const loop of loops) {
    for (let i = 1; i < loop.length - 1; i++) {
      extra.push(loop[0], loop[i], loop[i + 1])
    }
  }
  if (extra.length === 0) return indices
  const out = new Uint32Array(indices.length + extra.length)
  out.set(indices, 0)
  out.set(extra, indices.length)
  return out
}

// fullManifold (best-effort): remove every face touching a non-manifold edge
// (used by 3+ faces), then fill the holes that leaves. Robustly untangling
// non-manifold junctions in pure JS is hard; on pathological meshes this
// removes geometry rather than perfectly repairing it — documented in the UI.
function makeManifold(indices: Uint32Array): Uint32Array {
  const edgeUse = new Map<number, number>()
  for (let i = 0; i < indices.length; i += 3) {
    tallyEdges(edgeUse, indices[i], indices[i + 1], indices[i + 2])
  }
  const isBad = (a: number, b: number) => (edgeUse.get(undirectedEdgeKey(a, b)) ?? 0) >= 3

  const kept: number[] = []
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i],
      b = indices[i + 1],
      c = indices[i + 2]
    if (isBad(a, b) || isBad(b, c) || isBad(c, a)) continue
    kept.push(a, b, c)
  }
  return fillHoles(Uint32Array.from(kept))
}

function tallyEdges(m: Map<number, number>, a: number, b: number, c: number): void {
  for (const [x, y] of [
    [a, b],
    [b, c],
    [c, a],
  ] as const) {
    const key = undirectedEdgeKey(x, y)
    m.set(key, (m.get(key) ?? 0) + 1)
  }
}

function sortedTriKey(a: number, b: number, c: number): string {
  const s = [a, b, c].sort((x, y) => x - y)
  return `${s[0]},${s[1]},${s[2]}`
}

// Expand an indexed mesh back into triangle soup (each triangle's 3 vertices
// written out in full), the layout `writeBinarySTL` / `parseSTL` expect.
function indexedToSoup(positions: Float32Array, indices: Uint32Array): Float32Array {
  const out = new Float32Array(indices.length * 3)
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i]
    out[i * 3] = positions[v * 3]
    out[i * 3 + 1] = positions[v * 3 + 1]
    out[i * 3 + 2] = positions[v * 3 + 2]
  }
  return out
}
