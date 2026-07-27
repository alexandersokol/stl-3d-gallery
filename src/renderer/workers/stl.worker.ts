// Module Web Worker: parses STL bytes off the UI thread.
//
// Receives an ArrayBuffer of raw STL bytes as the message data, parses it
// with the pure `parseSTL`, derives `ModelStats` via `computeStats`, and
// posts the result back — transferring the positions buffer so the large
// typed array is moved (not copied) to whichever thread receives it.

import { parseSTL } from '../lib/stl-parser'
import { computeStats } from '../lib/model-stats'

// The renderer tsconfig uses the "DOM" lib (not "WebWorker"), so `self`
// here is typed as the main-thread Window rather than
// DedicatedWorkerGlobalScope. At runtime this file only ever executes
// inside a worker, so we go through a minimal local interface for the
// two calls we actually make instead of fighting the ambient DOM types.
interface WorkerScope {
  onmessage: ((e: MessageEvent<ArrayBuffer>) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}

const ctx = self as unknown as WorkerScope

ctx.onmessage = (e) => {
  try {
    const parsed = parseSTL(e.data)
    const stats = computeStats(parsed)
    ctx.postMessage({ ok: true, positions: parsed.positions, stats }, [parsed.positions.buffer])
  } catch (err) {
    ctx.postMessage({ ok: false, error: String(err) })
  }
}
