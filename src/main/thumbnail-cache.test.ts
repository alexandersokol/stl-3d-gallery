import { describe, it, expect, beforeEach } from 'vitest'
import { promises as fs } from 'fs'; import os from 'os'; import path from 'path'
import { readThumbnail, writeThumbnail } from './thumbnail-cache'

let dir: string, model: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'thumb-')); model = path.join(dir, 'x.stl'); await fs.writeFile(model, 'model') })

describe('thumbnail-cache', () => {
  it('null when missing', async () => expect(await readThumbnail(model)).toBeNull())
  it('write then read returns bytes', async () => {
    await writeThumbnail(model, Buffer.from('PNGDATA'))
    expect((await readThumbnail(model))!.toString()).toBe('PNGDATA')
  })
  it('null when source is newer than thumbnail (stale)', async () => {
    await writeThumbnail(model, Buffer.from('PNGDATA'))
    const future = new Date(Date.now() + 10_000)
    await fs.utimes(model, future, future)
    expect(await readThumbnail(model)).toBeNull()
  })
})
