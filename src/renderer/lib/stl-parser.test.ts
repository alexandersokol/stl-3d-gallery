/// <reference types="node" />
import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { parseSTL } from './stl-parser'

const load = (f: string) => {
  const b = readFileSync(path.resolve(__dirname, '../../../tests/fixtures', f))
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
}

describe('parseSTL', () => {
  for (const f of ['cube-bin.stl', 'cube-ascii.stl']) {
    it(`parses ${f}`, () => {
      const r = parseSTL(load(f))
      expect(r.triCount).toBe(12)
      expect(r.positions.length).toBe(108)
      expect(r.bbox.max).toEqual([1, 1, 1])
      expect(r.bbox.min).toEqual([0, 0, 0])
    })
  }

  it('produces identical positions for binary and ascii versions of the same cube', () => {
    const bin = parseSTL(load('cube-bin.stl'))
    const ascii = parseSTL(load('cube-ascii.stl'))
    expect(Array.from(ascii.positions)).toEqual(Array.from(bin.positions))
  })
})
