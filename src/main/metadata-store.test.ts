import { describe, it, expect, beforeEach } from 'vitest'
import { promises as fs } from 'fs'; import os from 'os'; import path from 'path'
import { readMetadata, writeMetadata, readMetadataBatch } from './metadata-store'
import { metaPath } from '../shared/paths'

let dir: string, model: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'meta-')); model = path.join(dir, 'x.stl'); await fs.writeFile(model, 'x') })

describe('metadata-store', () => {
  it('returns null when missing', async () => expect(await readMetadata(model)).toBeNull())
  it('writes then reads, merging', async () => {
    await writeMetadata(model, { tags: ['a'] })
    const m = await writeMetadata(model, { notes: 'hi' })
    expect(m.tags).toEqual(['a']); expect(m.notes).toBe('hi'); expect(m.schemaVersion).toBe(1)
    expect(await fs.readFile(metaPath(model), 'utf8')).toContain('"notes": "hi"')
    expect((await readMetadata(model))!.notes).toBe('hi')
  })
  it('clears a key when written as undefined', async () => {
    await writeMetadata(model, { linkedImage: 'x.stl.png' })
    const before = await readMetadata(model)
    expect(before!.linkedImage).toBe('x.stl.png')

    await writeMetadata(model, { linkedImage: undefined })
    const after = await readMetadata(model)
    expect(after!.linkedImage).toBeUndefined()

    const raw = await fs.readFile(metaPath(model), 'utf8')
    expect(raw).not.toContain('"linkedImage"')
  })
})

describe('readMetadataBatch', () => {
  it('maps path -> Metadata only for paths that have metadata', async () => {
    const p1 = path.join(dir, 'p1.stl')
    const p2 = path.join(dir, 'p2.stl')
    const p3 = path.join(dir, 'p3.stl')
    await fs.writeFile(p1, 'x'); await fs.writeFile(p2, 'x'); await fs.writeFile(p3, 'x')
    await writeMetadata(p1, { tags: ['one'] })
    await writeMetadata(p2, { tags: ['two'] })

    const result = await readMetadataBatch([p1, p2, p3])

    expect(Object.keys(result).sort()).toEqual([p1, p2].sort())
    expect(result[p1].tags).toEqual(['one'])
    expect(result[p2].tags).toEqual(['two'])
    expect(result[p3]).toBeUndefined()
  })

  it('returns an empty object for an empty input', async () => {
    expect(await readMetadataBatch([])).toEqual({})
  })
})
