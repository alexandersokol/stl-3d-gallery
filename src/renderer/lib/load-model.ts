// Glue: runs STL parsing in a one-shot Web Worker and returns a Promise.
//
// Spawns a fresh worker per call, posts the bytes (transferring the
// buffer so the copy isn't duplicated across threads), and terminates the
// worker once the single response has been received. A pool/reuse
// strategy can replace this later if spawn overhead becomes a problem;
// for v1 the simplicity of spawn-use-terminate is worth more.

import type { ModelStats } from '../../shared/types'

export interface LoadedModel {
  positions: Float32Array
  stats: ModelStats
}

type WorkerResponse = { ok: true; positions: Float32Array; stats: ModelStats } | { ok: false; error: string }

export function loadModel(bytes: ArrayBuffer): Promise<LoadedModel> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/stl.worker.ts', import.meta.url), { type: 'module' })

    const settle = (fn: () => void) => {
      fn()
      worker.terminate()
    }

    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const data = e.data
      if (data.ok) {
        settle(() => resolve({ positions: data.positions, stats: data.stats }))
      } else {
        settle(() => reject(new Error(data.error)))
      }
    }

    worker.onerror = (e: ErrorEvent) => {
      settle(() => reject(new Error(e.message)))
    }

    worker.postMessage(bytes, [bytes])
  })
}
