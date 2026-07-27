import { describe, it, expect } from 'vitest'
import { scanFolder } from './fs-scanner'
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
})
