import { promises as fs } from 'fs'; import path from 'path'
import { linkedPath } from '../shared/paths'
import { readMetadata, writeMetadata } from './metadata-store'

export async function writeLinkedImage(modelPath: string, bytes: Buffer, ext: string): Promise<string> {
  const meta = await readMetadata(modelPath)
  if (meta?.linkedImage) { await fs.rm(path.join(path.dirname(modelPath), '.linked', meta.linkedImage), { force: true }) }
  const p = linkedPath(modelPath, ext)
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, bytes)
  const name = path.basename(p)
  await writeMetadata(modelPath, { linkedImage: name })
  return name
}
export async function readLinkedImage(modelPath: string): Promise<{ bytes: Buffer; name: string } | null> {
  const meta = await readMetadata(modelPath)
  if (!meta?.linkedImage) return null
  const p = path.join(path.dirname(modelPath), '.linked', meta.linkedImage)
  try { return { bytes: await fs.readFile(p), name: meta.linkedImage } }
  catch (e: any) { if (e.code === 'ENOENT') return null; throw e }
}
export async function removeLinkedImage(modelPath: string): Promise<void> {
  const meta = await readMetadata(modelPath)
  if (meta?.linkedImage) await fs.rm(path.join(path.dirname(modelPath), '.linked', meta.linkedImage), { force: true })
  await writeMetadata(modelPath, { linkedImage: undefined })
}
