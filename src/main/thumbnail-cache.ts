import { promises as fs } from 'fs'; import path from 'path'
import { thumbPath } from '../shared/paths'

export async function readThumbnail(modelPath: string): Promise<Buffer | null> {
  const tp = thumbPath(modelPath)
  try {
    const [ts, ss] = await Promise.all([fs.stat(tp), fs.stat(modelPath)])
    if (ss.mtimeMs > ts.mtimeMs) return null // stale
    return await fs.readFile(tp)
  } catch (e: any) { if (e.code === 'ENOENT') return null; throw e }
}
export async function writeThumbnail(modelPath: string, png: Buffer): Promise<void> {
  const tp = thumbPath(modelPath)
  await fs.mkdir(path.dirname(tp), { recursive: true })
  await fs.writeFile(tp, png)
}
