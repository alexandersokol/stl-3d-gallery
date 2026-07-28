import { describe, it, expect } from 'vitest'
import { validateStlFilename } from './filename'

describe('validateStlFilename', () => {
  it('accepts a normal .stl name (spaces and dashes allowed)', () => {
    expect(validateStlFilename('girl.stl').ok).toBe(true)
    expect(validateStlFilename('my model-1 v2.stl').ok).toBe(true)
    expect(validateStlFilename('DRAGON.STL').ok).toBe(true) // extension case-insensitive
  })

  it('rejects an empty name', () => {
    expect(validateStlFilename('').ok).toBe(false)
    expect(validateStlFilename('   ').ok).toBe(false)
  })

  it('rejects a missing or wrong extension', () => {
    expect(validateStlFilename('model').ok).toBe(false)
    expect(validateStlFilename('model.txt').ok).toBe(false)
    expect(validateStlFilename('.stl').ok).toBe(false) // nothing before .stl
  })

  it('rejects path separators', () => {
    expect(validateStlFilename('a/b.stl').ok).toBe(false)
    expect(validateStlFilename('a\\b.stl').ok).toBe(false)
  })

  it('rejects illegal filename characters', () => {
    for (const bad of ['a<b.stl', 'a>b.stl', 'a:b.stl', 'a"b.stl', 'a|b.stl', 'a?b.stl', 'a*b.stl']) {
      expect(validateStlFilename(bad).ok).toBe(false)
    }
  })

  it('returns an error message when invalid', () => {
    const res = validateStlFilename('model.txt')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/\.stl/)
  })
})
