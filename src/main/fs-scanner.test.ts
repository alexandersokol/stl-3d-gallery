import { describe, it, expect } from 'vitest'
import { scanFolder, scanTree } from './fs-scanner'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
const tree = path.resolve(__dirname, '../../tests/fixtures/tree')

describe('scanFolder', () => {
  it('lists stl files with stat', async () => {
    const r = await scanFolder(tree)
    expect(r.files.map(f => f.name)).toEqual(['a.stl'])
    expect(r.files[0].size).toBeGreaterThan(0)
    expect(r.files[0].mtimeMs).toBeGreaterThan(0)
  })
  it('lists subfolders and excludes hidden dirs', async () => {
    const r = await scanFolder(tree)
    expect(r.folders.map(f => f.name)).toContain('sub')
    expect(r.folders.map(f => f.name)).not.toContain('.meta')
  })
  it('excludes a hidden dir that is actually present (non-vacuous)', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scanfolder-'))
    await fs.mkdir(path.join(dir, '.meta'))
    await fs.writeFile(path.join(dir, '.meta', 'dummy.json'), '{}')
    await fs.writeFile(path.join(dir, 'a.stl'), 'x')
    const r = await scanFolder(dir)
    expect(r.files.map(f => f.name)).toEqual(['a.stl'])
    expect(r.folders.map(f => f.name)).not.toContain('.meta')
  })
})

describe('scanTree', () => {
  it('recursively lists stl files at any depth', async () => {
    const files = await scanTree(tree)
    expect(files.map(f => f.name).sort()).toEqual(['a.stl', 'b.stl'])
    const bEntry = files.find(f => f.name === 'b.stl')!
    expect(bEntry.path).toBe(path.join(tree, 'sub', 'b.stl'))
    for (const f of files) {
      expect(f.size).toBeGreaterThan(0)
      expect(f.mtimeMs).toBeGreaterThan(0)
    }
  })
  it('skips HIDDEN_DIRS at every level', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scantree-'))
    await fs.writeFile(path.join(dir, 'x.stl'), 'x')
    await fs.mkdir(path.join(dir, '.meta'))
    await fs.writeFile(path.join(dir, '.meta', 'x.stl.json'), '{}')
    await fs.mkdir(path.join(dir, 'sub'))
    await fs.writeFile(path.join(dir, 'sub', 'y.stl'), 'y')
    const files = await scanTree(dir)
    expect(files.map(f => f.name).sort()).toEqual(['x.stl', 'y.stl'])
    expect(files.some(f => f.path.includes('.meta'))).toBe(false)
  })
  it('rejects when the top-level dir does not exist', async () => {
    await expect(scanTree('/nonexistent/definitely-not-here')).rejects.toThrow()
  })
  // POSIX-only: this simulates an unreadable directory with `chmod 0o000`,
  // which Windows doesn't honor (the dir stays readable there), so the walk
  // would still descend into it. Skip on Windows -- the behavior under test is
  // a POSIX permission error path.
  it.skipIf(process.platform === 'win32')(
    'skips unreadable subdirectories without failing the whole walk',
    async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scantree-unreadable-'))
      await fs.writeFile(path.join(dir, 'x.stl'), 'x')
      const bad = path.join(dir, 'bad')
      await fs.mkdir(bad)
      await fs.writeFile(path.join(bad, 'y.stl'), 'y')
      await fs.chmod(bad, 0o000)
      try {
        const files = await scanTree(dir)
        expect(files.map((f) => f.name)).toEqual(['x.stl'])
      } finally {
        await fs.chmod(bad, 0o755)
      }
    },
  )
})
