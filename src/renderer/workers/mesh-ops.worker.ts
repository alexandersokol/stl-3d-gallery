// Module Web Worker: runs mesh analysis and repair off the UI thread.
//
// Receives the raw STL bytes plus an op ('analyze' | 'repair'); parses them
// with the pure `parseSTL`, then either analyzes the mesh or repairs it and
// re-encodes to binary STL. The repaired STL buffer is transferred back so the
// large typed array is moved (not copied) to the main thread.

import { parseSTL } from '../lib/stl-parser'
import { analyzeMesh } from '../lib/mesh-analysis'
import { repairMesh } from '../lib/mesh-repair'
import { writeBinarySTL } from '../lib/stl-writer'
import type { MeshAnalysis, RepairOptions } from '../../shared/types'

type Request =
  | { op: 'analyze'; bytes: ArrayBuffer }
  | { op: 'repair'; bytes: ArrayBuffer; options: RepairOptions }

type Response =
  | { ok: true; op: 'analyze'; analysis: MeshAnalysis }
  | { ok: true; op: 'repair'; bytes: ArrayBuffer }
  | { ok: false; error: string }

// The renderer tsconfig uses the "DOM" lib (not "WebWorker"), so `self` here
// is typed as Window rather than DedicatedWorkerGlobalScope. At runtime this
// only ever executes inside a worker, so we go through a minimal local
// interface for the two calls we actually make (see stl.worker.ts).
interface WorkerScope {
  onmessage: ((e: MessageEvent<Request>) => void) | null
  postMessage(message: Response, transfer?: Transferable[]): void
}

const ctx = self as unknown as WorkerScope

ctx.onmessage = (e) => {
  const req = e.data
  try {
    const { positions } = parseSTL(req.bytes)
    if (req.op === 'analyze') {
      ctx.postMessage({ ok: true, op: 'analyze', analysis: analyzeMesh(positions) })
    } else {
      const repaired = repairMesh(positions, req.options)
      const stl = writeBinarySTL(repaired)
      ctx.postMessage({ ok: true, op: 'repair', bytes: stl }, [stl])
    }
  } catch (err) {
    ctx.postMessage({ ok: false, error: String(err) })
  }
}
