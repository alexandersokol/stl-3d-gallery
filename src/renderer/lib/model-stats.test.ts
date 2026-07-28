import { describe, it, expect } from 'vitest'
import { computeStats } from './model-stats'
import type { ParsedSTL } from './stl-parser'

describe('computeStats', () => {
  it('computes vertCount, triCount, and bbox dims from a ParsedSTL', () => {
    const parsed: ParsedSTL = {
      positions: new Float32Array(12 * 9),
      triCount: 12,
      bbox: { min: [0, 0, 0], max: [2, 3, 4] },
    }

    const stats = computeStats(parsed)

    expect(stats.triCount).toBe(12)
    expect(stats.vertCount).toBe(36)
    expect(stats.bbox).toEqual({ x: 2, y: 3, z: 4 })
  })

  it('handles non-zero-origin bboxes (dims are max - min, not raw max)', () => {
    const parsed: ParsedSTL = {
      positions: new Float32Array(2 * 9),
      triCount: 2,
      bbox: { min: [-5, 10, 1], max: [5, 12, 1] },
    }

    const stats = computeStats(parsed)

    expect(stats.vertCount).toBe(6)
    expect(stats.bbox).toEqual({ x: 10, y: 2, z: 0 })
  })
})
