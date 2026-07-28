// Glue: runs mesh analysis / repair in a one-shot Web Worker and returns a
// Promise. Spawns a fresh worker per call and terminates it once the single
// response arrives (same spawn-use-terminate strategy as load-model.ts).
//
// Both calls transfer the input bytes into the worker, which detaches the
// caller's ArrayBuffer — callers pass freshly-read bytes and never reuse them.

import type { MeshAnalysis, RepairOptions } from '../../shared/types'

type WorkerResponse =
  | { ok: true; op: 'analyze'; analysis: MeshAnalysis }
  | { ok: true; op: 'repair'; bytes: ArrayBuffer }
  | { ok: false; error: string }

function run<T>(
  request: { op: 'analyze'; bytes: ArrayBuffer } | { op: 'repair'; bytes: ArrayBuffer; options: RepairOptions },
  extract: (r: Extract<WorkerResponse, { ok: true }>) => T,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/mesh-ops.worker.ts', import.meta.url), { type: 'module' })

    const settle = (fn: () => void) => {
      fn()
      worker.terminate()
    }

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const data = e.data
      if (data.ok) settle(() => resolve(extract(data)))
      else settle(() => reject(new Error(data.error)))
    }
    worker.onerror = (e: ErrorEvent) => settle(() => reject(new Error(e.message)))

    worker.postMessage(request, [request.bytes])
  })
}

export function analyzeModel(bytes: ArrayBuffer): Promise<MeshAnalysis> {
  return run({ op: 'analyze', bytes }, (r) => {
    if (r.op !== 'analyze') throw new Error('unexpected worker response')
    return r.analysis
  })
}

export function repairModel(bytes: ArrayBuffer, options: RepairOptions): Promise<ArrayBuffer> {
  return run({ op: 'repair', bytes, options }, (r) => {
    if (r.op !== 'repair') throw new Error('unexpected worker response')
    return r.bytes
  })
}
