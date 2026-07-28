import { describe, it, expect } from 'vitest'
import { writeBinarySTL } from './stl-writer'
import { parseSTL } from './stl-parser'

describe('writeBinarySTL', () => {
  it('round-trips triangle-soup positions through parseSTL', () => {
    // Two triangles' worth of soup (18 floats).
    const positions = Float32Array.from([
      0, 0, 0, 1, 0, 0, 0, 1, 0, // triangle 1
      0, 0, 0, 0, 1, 0, 0, 0, 1, // triangle 2
    ])
    const buf = writeBinarySTL(positions)
    const parsed = parseSTL(buf)

    expect(parsed.triCount).toBe(2)
    expect(parsed.positions.length).toBe(positions.length)
    for (let i = 0; i < positions.length; i++) {
      expect(parsed.positions[i]).toBeCloseTo(positions[i], 5)
    }
  })

  it('produces a binary STL of the expected byte length', () => {
    const positions = Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0])
    const buf = writeBinarySTL(positions)
    expect(buf.byteLength).toBe(84 + 1 * 50) // header + count + one facet
  })

  it('writes an empty (zero-triangle) mesh', () => {
    const buf = writeBinarySTL(new Float32Array(0))
    expect(buf.byteLength).toBe(84)
    expect(parseSTL(buf).triCount).toBe(0)
  })
})
