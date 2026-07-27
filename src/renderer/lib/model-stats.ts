// PURE helper: derives display stats from a ParsedSTL. No DOM, no worker
// APIs — safe to call on either side of the worker boundary.

import type { ParsedSTL } from './stl-parser'
import type { ModelStats } from '../../shared/types'

export function computeStats(p: ParsedSTL): ModelStats {
  return {
    triCount: p.triCount,
    vertCount: p.triCount * 3,
    bbox: {
      x: p.bbox.max[0] - p.bbox.min[0],
      y: p.bbox.max[1] - p.bbox.min[1],
      z: p.bbox.max[2] - p.bbox.min[2],
    },
  }
}
