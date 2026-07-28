import { describe, it, expect, beforeEach, vi } from 'vitest'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

// file-ops imports { shell } from 'electron' for deleteModel; stub it.
const trashItem = vi.fn(async (..._a: unknown[]) => {})
vi.mock('electron', () => ({ shell: { trashItem: (...a: unknown[]) => trashItem(...a) } }))

import { renameModel, copyModel, moveModel, deleteModel } from './file-ops'

let dir: string
let model: string
const BASE = 'girl.stl'

async function seedModelWithSidecars(): Promise<void> {
  await fs.writeFile(model, 'STL-BYTES')
  await fs.mkdir(path.join(dir, '.meta'), { recursive: true })
  await fs.writeFile(
    path.join(dir, '.meta', `${BASE}.json`),
    JSON.stringify({ schemaVersion: 1, tags: ['a'], notes: 'n', linkedImage: `${BASE}.png`, updatedAt: '' }),
  )
  await fs.mkdir(path.join(dir, '.thumb'), { recursive: true })
  await fs.writeFile(path.join(dir, '.thumb', `${BASE}.v6_studio.png`), 'THUMB')
  await fs.mkdir(path.join(dir, '.linked'), { recursive: true })
  await fs.writeFile(path.join(dir, '.linked', `${BASE}.png`), 'IMG')
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

beforeEach(async () => {
  trashItem.mockClear()
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileops-'))
  model = path.join(dir, BASE)
  await seedModelWithSidecars()
})

describe('renameModel', () => {
  it('moves the model and all sidecars to the new basename, and updates linkedImage', async () => {
    const { path: newPath } = await renameModel(model, 'dragon.stl')
    expect(newPath).toBe(path.join(dir, 'dragon.stl'))

    // Model moved.
    expect(await exists(model)).toBe(false)
    expect((await fs.readFile(newPath)).toString()).toBe('STL-BYTES')

    // Sidecars carried + renamed.
    expect(await exists(path.join(dir, '.meta', `${BASE}.json`))).toBe(false)
    expect(await exists(path.join(dir, '.thumb', `${BASE}.v6_studio.png`))).toBe(false)
    expect(await exists(path.join(dir, '.linked', `${BASE}.png`))).toBe(false)
    expect((await fs.readFile(path.join(dir, '.thumb', 'dragon.stl.v6_studio.png'))).toString()).toBe('THUMB')
    expect((await fs.readFile(path.join(dir, '.linked', 'dragon.stl.png'))).toString()).toBe('IMG')

    // linkedImage reference rewritten to the new basename.
    const meta = JSON.parse(await fs.readFile(path.join(dir, '.meta', 'dragon.stl.json'), 'utf8'))
    expect(meta.linkedImage).toBe('dragon.stl.png')
    expect(meta.tags).toEqual(['a'])
  })

  it('rejects an invalid name and a name that already exists', async () => {
    await expect(renameModel(model, 'bad/name.stl')).rejects.toThrow()
    await expect(renameModel(model, 'notstl.txt')).rejects.toThrow()
    await fs.writeFile(path.join(dir, 'taken.stl'), 'x')
    await expect(renameModel(model, 'taken.stl')).rejects.toThrow(/already exists/)
  })
})

describe('copyModel', () => {
  it('duplicates the model and sidecars under the new name, leaving the original', async () => {
    const { path: newPath } = await copyModel(model, 'girl2.stl')
    expect(newPath).toBe(path.join(dir, 'girl2.stl'))

    // Original intact.
    expect((await fs.readFile(model)).toString()).toBe('STL-BYTES')
    expect(await exists(path.join(dir, '.meta', `${BASE}.json`))).toBe(true)

    // Copy + its sidecars exist with new names.
    expect((await fs.readFile(newPath)).toString()).toBe('STL-BYTES')
    expect((await fs.readFile(path.join(dir, '.thumb', 'girl2.stl.v6_studio.png'))).toString()).toBe('THUMB')
    const meta = JSON.parse(await fs.readFile(path.join(dir, '.meta', 'girl2.stl.json'), 'utf8'))
    expect(meta.linkedImage).toBe('girl2.stl.png')
    expect((await fs.readFile(path.join(dir, '.linked', 'girl2.stl.png'))).toString()).toBe('IMG')
  })
})

describe('moveModel', () => {
  it('moves the model + sidecars (same name) into the target folder', async () => {
    const target = path.join(dir, 'sub')
    await fs.mkdir(target)

    const { path: newPath } = await moveModel(model, target)
    expect(newPath).toBe(path.join(target, BASE))

    expect(await exists(model)).toBe(false)
    expect((await fs.readFile(newPath)).toString()).toBe('STL-BYTES')
    expect((await fs.readFile(path.join(target, '.thumb', `${BASE}.v6_studio.png`))).toString()).toBe('THUMB')
    expect((await fs.readFile(path.join(target, '.meta', `${BASE}.json`))).toString()).toContain('"tags"')
    expect(await exists(path.join(dir, '.thumb', `${BASE}.v6_studio.png`))).toBe(false)
  })

  it('rejects moving into the same folder or onto an existing file', async () => {
    await expect(moveModel(model, dir)).rejects.toThrow(/already in that folder/)
    const target = path.join(dir, 'sub2')
    await fs.mkdir(target)
    await fs.writeFile(path.join(target, BASE), 'other')
    await expect(moveModel(model, target)).rejects.toThrow(/already exists/)
  })
})

describe('deleteModel', () => {
  it('sends the model and every sidecar to the trash', async () => {
    await deleteModel(model)
    const trashed = trashItem.mock.calls.map((c) => c[0] as string)
    expect(trashed).toContain(model)
    expect(trashed).toContain(path.join(dir, '.meta', `${BASE}.json`))
    expect(trashed).toContain(path.join(dir, '.thumb', `${BASE}.v6_studio.png`))
    expect(trashed).toContain(path.join(dir, '.linked', `${BASE}.png`))
  })
})
