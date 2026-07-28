// PURE mesh topology helpers shared by analysis and repair. No three.js, no
// DOM, no fs — operates on plain typed arrays, safe to run in a Web Worker.
//
// STL is "triangle soup" (every triangle carries its own 3 vertices, nothing
// shared), so any topology question — is this edge a hole? shared by too many
// faces? — is only meaningful AFTER welding coincident vertices into a shared,
// indexed representation. `weldVertices` is that merge-by-distance step
// (Blender's 3D-print toolbox relies on the same idea); everything else here
// operates on the resulting index buffer.

export interface IndexedMesh {
  positions: Float32Array // unique vertex coords, length = vertCount * 3
  indices: Uint32Array // 3 per triangle, into `positions`
  tol: number // the weld tolerance actually used (also a good degeneracy scale)
}

// Merge vertices that fall within `tol` of each other onto a shared index.
// `tol` defaults to a small fraction of the bounding-box diagonal so it scales
// with the model (a 200mm print and a 2mm one both weld sensibly), with an
// absolute floor so a degenerate/zero-size mesh can't produce tol = 0.
export function weldVertices(positions: Float32Array, tol?: number): IndexedMesh {
  const vertCount = Math.floor(positions.length / 3)
  const resolvedTol = tol ?? weldTolerance(positions)
  const inv = 1 / resolvedTol

  const map = new Map<string, number>()
  const out: number[] = []
  const indices = new Uint32Array(vertCount)

  for (let i = 0; i < vertCount; i++) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    // Snap to the tolerance grid and key on the integer cell. Two vertices in
    // the same cell are treated as coincident. (Grid snapping can miss a pair
    // straddling a cell boundary, but for the tiny float-rounding gaps this
    // targets that is rare and harmless.)
    const key = `${Math.round(x * inv)},${Math.round(y * inv)},${Math.round(z * inv)}`
    let idx = map.get(key)
    if (idx === undefined) {
      idx = out.length / 3
      out.push(x, y, z)
      map.set(key, idx)
    }
    indices[i] = idx
  }

  return { positions: new Float32Array(out), indices, tol: resolvedTol }
}

export function weldTolerance(positions: Float32Array): number {
  const vertCount = Math.floor(positions.length / 3)
  if (vertCount === 0) return 1e-6
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity
  for (let i = 0; i < vertCount; i++) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1]
    const z = positions[i * 3 + 2]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }
  const dx = maxX - minX
  const dy = maxY - minY
  const dz = maxZ - minZ
  const diag = Math.sqrt(dx * dx + dy * dy + dz * dz)
  return Math.max(1e-6, diag * 1e-6)
}

// Packs an undirected edge (unordered vertex-index pair) into a single number
// key. Safe up to ~9e7 vertices before exceeding Number.MAX_SAFE_INTEGER,
// far beyond any mesh this app handles.
export function undirectedEdgeKey(a: number, b: number): number {
  const lo = a < b ? a : b
  const hi = a < b ? b : a
  return lo * 100000000 + hi
}

// Twice the area of triangle (a,b,c): the magnitude of the edge cross product.
// Used to detect degenerate (zero-area / sliver / collinear) triangles.
export function triangleArea2(positions: Float32Array, a: number, b: number, c: number): number {
  const ax = positions[a * 3],
    ay = positions[a * 3 + 1],
    az = positions[a * 3 + 2]
  const bx = positions[b * 3],
    by = positions[b * 3 + 1],
    bz = positions[b * 3 + 2]
  const cx = positions[c * 3],
    cy = positions[c * 3 + 1],
    cz = positions[c * 3 + 2]
  const ux = bx - ax,
    uy = by - ay,
    uz = bz - az
  const vx = cx - ax,
    vy = cy - ay,
    vz = cz - az
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  return Math.sqrt(nx * nx + ny * ny + nz * nz)
}

// A triangle is degenerate if two of its (welded) corners collapsed to the
// same index, or its area is below the weld tolerance squared (it fits inside
// a single weld cell, so it carries no real surface).
export function isDegenerateTriangle(
  positions: Float32Array,
  a: number,
  b: number,
  c: number,
  tol: number,
): boolean {
  if (a === b || b === c || a === c) return true
  return triangleArea2(positions, a, b, c) < tol * tol
}

// Assembles the mesh's boundary (hole) edges into ordered vertex loops so they
// can be triangulated shut. A boundary edge is one used by exactly one
// triangle; we record it as a directed half-edge in that triangle's winding
// order, then chain the half-edges into loops.
//
// The adjacency is a multimap (a vertex can have several outgoing boundary
// half-edges — common on real meshes and after non-manifold face removal) and
// half-edges are consumed as they're walked, so several holes touching a
// shared vertex are all recovered. Only genuinely-closed loops (the walk
// returns to its start) are returned; an open chain that dead-ends is
// discarded rather than fan-filled into bad geometry.
export function boundaryLoops(indices: Uint32Array): number[][] {
  const undirectedCount = new Map<number, number>()
  for (let i = 0; i < indices.length; i += 3) {
    tally(undirectedCount, indices[i], indices[i + 1])
    tally(undirectedCount, indices[i + 1], indices[i + 2])
    tally(undirectedCount, indices[i + 2], indices[i])
  }

  const outgoing = new Map<number, number[]>() // from -> unused boundary targets
  const addEdge = (from: number, to: number) => {
    if (undirectedCount.get(undirectedEdgeKey(from, to)) !== 1) return
    const list = outgoing.get(from)
    if (list) list.push(to)
    else outgoing.set(from, [to])
  }
  for (let i = 0; i < indices.length; i += 3) {
    addEdge(indices[i], indices[i + 1])
    addEdge(indices[i + 1], indices[i + 2])
    addEdge(indices[i + 2], indices[i])
  }

  const loops: number[][] = []
  for (const start of [...outgoing.keys()]) {
    while ((outgoing.get(start)?.length ?? 0) > 0) {
      const loop: number[] = []
      let v = start
      let closed = false
      while (true) {
        const outs = outgoing.get(v)
        if (!outs || outs.length === 0) break // dead end — not a closed loop
        loop.push(v)
        v = outs.pop() as number
        if (v === start) {
          closed = true
          break
        }
      }
      if (closed && loop.length >= 3) loops.push(loop)
    }
  }
  return loops
}

function tally(m: Map<number, number>, a: number, b: number): void {
  const key = undirectedEdgeKey(a, b)
  m.set(key, (m.get(key) ?? 0) + 1)
}
