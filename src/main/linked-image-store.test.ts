import { describe, it, expect, beforeEach } from 'vitest'
import { promises as fs } from 'fs'; import os from 'os'; import path from 'path'
import { writeLinkedImage, readLinkedImage, removeLinkedImage } from './linked-image-store'
import { readMetadata } from './metadata-store'

let dir: string, model: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'link-')); model = path.join(dir, 'x.stl'); await fs.writeFile(model, 'm') })

describe('linked-image-store', () => {
  it('writes image, sets sidecar, reads back', async () => {
    const name = await writeLinkedImage(model, Buffer.from('IMG1'), 'png')
    expect(name).toBe('x.stl.png')
    expect((await readMetadata(model))!.linkedImage).toBe('x.stl.png')
    const r = await readLinkedImage(model); expect(r!.bytes.toString()).toBe('IMG1'); expect(r!.name).toBe('x.stl.png')
  })
  it('replace deletes previous ext', async () => {
    await writeLinkedImage(model, Buffer.from('A'), 'png')
    await writeLinkedImage(model, Buffer.from('B'), 'jpg')
    expect((await readMetadata(model))!.linkedImage).toBe('x.stl.jpg')
    await expect(fs.access(path.join(dir, '.linked', 'x.stl.png'))).rejects.toBeTruthy()
  })
  it('detach clears field and deletes file', async () => {
    await writeLinkedImage(model, Buffer.from('A'), 'png')
    await removeLinkedImage(model)
    expect(await readLinkedImage(model)).toBeNull()
    expect((await readMetadata(model))!.linkedImage).toBeUndefined()
  })
})
