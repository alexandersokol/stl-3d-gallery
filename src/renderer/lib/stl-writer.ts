// PURE binary-STL writer: triangle soup -> binary STL ArrayBuffer. No DOM /
// three.js / fs. Round-trips with `parseSTL` (same 80-byte header, uint32
// triangle count, then 50 bytes per facet: normal + 3 verts + attr count).
//
// Per-facet normals are computed from the winding (right-hand rule). Most
// slicers recompute normals from vertex order anyway, but writing a real
// normal keeps the file well-formed.

const HEADER_BYTES = 80
const COUNT_BYTES = 4
const TRIANGLE_STRIDE = 50

export function writeBinarySTL(positions: Float32Array): ArrayBuffer {
  const triCount = Math.floor(positions.length / 9)
  const buf = new ArrayBuffer(HEADER_BYTES + COUNT_BYTES + triCount * TRIANGLE_STRIDE)
  const view = new DataView(buf)

  // 80-byte header left as zeros; deliberately not starting with "solid" so
  // nothing mistakes this for ASCII (parseSTL keys off the size, but be tidy).
  view.setUint32(HEADER_BYTES, triCount, true)

  let offset = HEADER_BYTES + COUNT_BYTES
  for (let t = 0; t < triCount; t++) {
    const p = t * 9
    const ax = positions[p],
      ay = positions[p + 1],
      az = positions[p + 2]
    const bx = positions[p + 3],
      by = positions[p + 4],
      bz = positions[p + 5]
    const cx = positions[p + 6],
      cy = positions[p + 7],
      cz = positions[p + 8]

    const [nx, ny, nz] = faceNormal(ax, ay, az, bx, by, bz, cx, cy, cz)
    view.setFloat32(offset, nx, true)
    view.setFloat32(offset + 4, ny, true)
    view.setFloat32(offset + 8, nz, true)

    view.setFloat32(offset + 12, ax, true)
    view.setFloat32(offset + 16, ay, true)
    view.setFloat32(offset + 20, az, true)
    view.setFloat32(offset + 24, bx, true)
    view.setFloat32(offset + 28, by, true)
    view.setFloat32(offset + 32, bz, true)
    view.setFloat32(offset + 36, cx, true)
    view.setFloat32(offset + 40, cy, true)
    view.setFloat32(offset + 44, cz, true)

    view.setUint16(offset + 48, 0, true) // attribute byte count
    offset += TRIANGLE_STRIDE
  }

  return buf
}

function faceNormal(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
): [number, number, number] {
  const ux = bx - ax,
    uy = by - ay,
    uz = bz - az
  const vx = cx - ax,
    vy = cy - ay,
    vz = cz - az
  let nx = uy * vz - uz * vy
  let ny = uz * vx - ux * vz
  let nz = ux * vy - uy * vx
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (len > 0) {
    nx /= len
    ny /= len
    nz /= len
  }
  return [nx, ny, nz]
}
