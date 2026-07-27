import path from 'path'
import { describe, it, expect } from 'vitest'
import { metaPath, thumbPath, linkedPath, HIDDEN_DIRS } from './paths'

describe('paths', () => {
  const m = path.join('/prints', 'dragons', '123.stl')
  const dir = path.dirname(m)
  const base = path.basename(m)

  it('maps metadata', () =>
    expect(metaPath(m)).toBe(path.join(dir, '.meta', base + '.json')))

  it('maps thumbnail', () =>
    expect(thumbPath(m)).toBe(path.join(dir, '.thumb', base + '.png')))

  it('maps linked image with ext', () =>
    expect(linkedPath(m, 'png')).toBe(path.join(dir, '.linked', base + '.png')))

  it('lists hidden dirs', () => expect(HIDDEN_DIRS).toEqual(['.meta', '.thumb', '.linked']))
})
