// PURE STL parser. No three.js, no DOM, no Node fs — receives an
// ArrayBuffer and returns typed data only. Must be safe to run inside a
// Web Worker (only TextDecoder / DataView / typed arrays are used).

export interface ParsedSTL {
  positions: Float32Array // length = triCount * 9 (3 verts * 3 coords per triangle)
  triCount: number
  bbox: { min: [number, number, number]; max: [number, number, number] }
}

const BINARY_TRICOUNT_OFFSET = 80
const BINARY_TRIANGLE_STRIDE = 50 // 12 (normal) + 36 (3 verts * 3 floats) + 2 (attr byte count)
const BINARY_DATA_OFFSET = 84

/**
 * Decide binary vs ASCII. Authoritative signal: does the exact declared
 * triangle count (uint32 LE at byte 80) account for the whole file size
 * under the binary layout (84 + count*50 bytes)? Some binary STL files
 * still start with the ASCII "solid" keyword, so we deliberately do NOT
 * treat that prefix as decisive — the size check is checked first and
 * wins whenever it matches.
 */
function isBinarySTL(buf: ArrayBuffer): boolean {
  if (buf.byteLength < BINARY_DATA_OFFSET) return false
  const view = new DataView(buf)
  const count = view.getUint32(BINARY_TRICOUNT_OFFSET, true)
  if (BINARY_DATA_OFFSET + count * BINARY_TRIANGLE_STRIDE === buf.byteLength) {
    return true
  }
  return false
}

function parseBinarySTL(buf: ArrayBuffer): ParsedSTL {
  const view = new DataView(buf)
  const triCount = view.getUint32(BINARY_TRICOUNT_OFFSET, true)
  const positions = new Float32Array(triCount * 9)

  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]

  let offset = BINARY_DATA_OFFSET
  let p = 0
  for (let t = 0; t < triCount; t++) {
    offset += 12 // skip normal
    for (let v = 0; v < 3; v++) {
      const x = view.getFloat32(offset, true)
      const y = view.getFloat32(offset + 4, true)
      const z = view.getFloat32(offset + 8, true)
      offset += 12
      positions[p++] = x
      positions[p++] = y
      positions[p++] = z
      if (x < min[0]) min[0] = x
      if (y < min[1]) min[1] = y
      if (z < min[2]) min[2] = z
      if (x > max[0]) max[0] = x
      if (y > max[1]) max[1] = y
      if (z > max[2]) max[2] = z
    }
    offset += 2 // skip attribute byte count
  }

  return { positions, triCount, bbox: finalizeBbox(min, max) }
}

const VERTEX_LINE_RE = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g

function parseAsciiSTL(buf: ArrayBuffer): ParsedSTL {
  const text = new TextDecoder('utf-8').decode(buf)

  const coords: number[] = []
  VERTEX_LINE_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = VERTEX_LINE_RE.exec(text)) !== null) {
    coords.push(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]))
  }

  if (coords.length % 9 !== 0) {
    throw new Error(`Malformed ASCII STL: ${coords.length / 3} vertices is not a whole number of triangles`)
  }

  const triCount = Math.floor(coords.length / 9)
  const positions = new Float32Array(triCount * 9)

  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]

  for (let i = 0; i < positions.length; i++) {
    positions[i] = coords[i]
    const axis = i % 3
    const val = coords[i]
    if (val < min[axis]) min[axis] = val
    if (val > max[axis]) max[axis] = val
  }

  return { positions, triCount, bbox: finalizeBbox(min, max) }
}

function finalizeBbox(
  min: [number, number, number],
  max: [number, number, number],
): { min: [number, number, number]; max: [number, number, number] } {
  // Empty mesh: no vertices were seen, so min/max are still +-Infinity.
  // Fall back to a sane default of all zeros.
  if (!Number.isFinite(min[0])) {
    return { min: [0, 0, 0], max: [0, 0, 0] }
  }
  return { min, max }
}

export function parseSTL(buf: ArrayBuffer): ParsedSTL {
  return isBinarySTL(buf) ? parseBinarySTL(buf) : parseAsciiSTL(buf)
}
