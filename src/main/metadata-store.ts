import { promises as fs } from 'fs'; import path from 'path'
import type { Metadata } from '../shared/types'; import { metaPath } from '../shared/paths'

const DEFAULT: Metadata = { schemaVersion: 1, tags: [], notes: '', updatedAt: '' }

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

export async function writeMetadata(modelPath: string, data: Partial<Metadata>): Promise<Metadata> {
  const cur = (await readMetadata(modelPath)) ?? DEFAULT
  const next: Metadata = { ...cur, ...data, schemaVersion: 1, updatedAt: new Date().toISOString() }
  for (const k of Object.keys(next)) {
    if ((next as any)[k] === undefined) delete (next as any)[k]
  }
  const p = metaPath(modelPath)
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, JSON.stringify(next, null, 2))
  return next
}
