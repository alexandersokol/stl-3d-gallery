import { promises as fs } from 'fs'; import path from 'path'
import type { Metadata } from '../shared/types'; import { metaPath } from '../shared/paths'

const makeDefault = (): Metadata => ({ schemaVersion: 1, tags: [], notes: '', updatedAt: '' })

export async function readMetadata(modelPath: string): Promise<Metadata | null> {
  try { return JSON.parse(await fs.readFile(metaPath(modelPath), 'utf8')) as Metadata }
  catch (e: any) { if (e.code === 'ENOENT') return null; throw e }
}
export async function readMetadataBatch(modelPaths: string[]): Promise<Record<string, Metadata>> {
  const entries = await Promise.all(
    modelPaths.map(async (p) => [p, await readMetadata(p)] as const)
  )
  const result: Record<string, Metadata> = {}
  for (const [p, meta] of entries) {
    if (meta) result[p] = meta
  }
  return result
}

// Two renderer paths can write the same model's sidecar concurrently (the
// debounced tag/notes save and the linked-image attach/detach). Without
// serialization, an interleaved read-modify-write can clobber the other
// writer's key. Chain each path's writes onto a per-path promise so writes
// to the SAME model run strictly sequentially, while writes to different
// models stay parallel. Entries are removed once their chain settles so the
// map doesn't grow unboundedly.
const writeChains = new Map<string, Promise<unknown>>()

async function doWriteMetadata(modelPath: string, data: Partial<Metadata>): Promise<Metadata> {
  const cur = (await readMetadata(modelPath)) ?? makeDefault()
  const next: Metadata = { ...cur, ...data, schemaVersion: 1, updatedAt: new Date().toISOString() }
  if (next.linkedImage === undefined) delete (next as any).linkedImage
  const p = metaPath(modelPath)
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, JSON.stringify(next, null, 2))
  return next
}

export function writeMetadata(modelPath: string, data: Partial<Metadata>): Promise<Metadata> {
  const key = metaPath(modelPath)
  const prior = writeChains.get(key) ?? Promise.resolve()
  const run = prior.then(() => doWriteMetadata(modelPath, data), () => doWriteMetadata(modelPath, data))
  // Swallow rejections in the chain tracker itself (each caller still gets
  // the real result/rejection from `run`); this only prevents one failed
  // write from permanently wedging the chain for that path.
  const settled = run.then(() => undefined, () => undefined)
  writeChains.set(key, settled)
  settled.finally(() => {
    if (writeChains.get(key) === settled) writeChains.delete(key)
  })
  return run
}
