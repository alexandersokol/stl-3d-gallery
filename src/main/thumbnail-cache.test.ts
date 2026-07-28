import { describe, it, expect, beforeEach } from 'vitest'
import { promises as fs } from 'fs'; import os from 'os'; import path from 'path'
import { readThumbnail, writeThumbnail, THUMB_RENDER_VERSION } from './thumbnail-cache'

let dir: string, model: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'thumb-')); model = path.join(dir, 'x.stl'); await fs.writeFile(model, 'model') })

describe('thumbnail-cache', () => {
  it('null when missing', async () => expect(await readThumbnail(model)).toBeNull())
  it('write then read returns bytes', async () => {
    await writeThumbnail(model, Buffer.from('PNGDATA'))
    expect((await readThumbnail(model))!.toString()).toBe('PNGDATA')
  })
  it('writes to a versioned path on disk', async () => {
    await writeThumbnail(model, Buffer.from('PNGDATA'))
    const expected = path.join(dir, '.thumb', `x.stl.v${THUMB_RENDER_VERSION}.png`)
    expect((await fs.readFile(expected)).toString()).toBe('PNGDATA')
  })
  it('null when source is newer than thumbnail (stale)', async () => {
    await writeThumbnail(model, Buffer.from('PNGDATA'))
    const future = new Date(Date.now() + 10_000)
    await fs.utimes(model, future, future)
    expect(await readThumbnail(model)).toBeNull()
  })
  it('ignores an old-version thumbnail and regenerates', async () => {
    const thumbDir = path.join(dir, '.thumb')
    await fs.mkdir(thumbDir, { recursive: true })
    const oldPath = path.join(thumbDir, 'x.stl.v1.png')
    await fs.writeFile(oldPath, 'OLDPNG')
    // Old-version file is newer than nothing written at current version yet.
    expect(await readThumbnail(model)).toBeNull()
  })
  it('cleans up old-version thumbnails on write', async () => {
    const thumbDir = path.join(dir, '.thumb')
    await fs.mkdir(thumbDir, { recursive: true })
    const oldPath = path.join(thumbDir, 'x.stl.v1.png')
    await fs.writeFile(oldPath, 'OLDPNG')

    await writeThumbnail(model, Buffer.from('NEWPNG'))

    // Current version is read back correctly, not the old one.
    expect((await readThumbnail(model))!.toString()).toBe('NEWPNG')

    // Old version file has been removed.
    await expect(fs.stat(oldPath)).rejects.toMatchObject({ code: 'ENOENT' })

    // Current version file exists.
    const currentPath = path.join(thumbDir, `x.stl.v${THUMB_RENDER_VERSION}.png`)
    expect((await fs.readFile(currentPath)).toString()).toBe('NEWPNG')
  })
})
