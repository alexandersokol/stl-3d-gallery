import { describe, it, expect } from 'vitest'
import { filterModels, allTags, type Indexed } from './filter'
import type { FileEntry } from '../../shared/types'

const file = (name: string): FileEntry => ({ path: `/x/${name}`, name, size: 1, mtimeMs: 1 })

const items: Indexed[] = [
  { file: file('Bunny.stl'), tags: ['animal', 'cute'] },
  { file: file('gear.stl'), tags: ['mechanical'] },
  { file: file('Vase.stl'), tags: ['home', 'animal'] },
  { file: file('sword.stl'), tags: [] },
]

describe('filterModels', () => {
  it('returns all files when query and tags are empty', () => {
    expect(filterModels(items, '', []).map(f => f.name)).toEqual([
      'Bunny.stl', 'gear.stl', 'Vase.stl', 'sword.stl',
    ])
  })

  it('matches name case-insensitively by substring', () => {
    expect(filterModels(items, 'vas', []).map(f => f.name)).toEqual(['Vase.stl'])
    expect(filterModels(items, 'STL', []).map(f => f.name)).toEqual([
      'Bunny.stl', 'gear.stl', 'Vase.stl', 'sword.stl',
    ])
  })

  it('requires ALL active tags to be present (AND semantics)', () => {
    expect(filterModels(items, '', ['animal']).map(f => f.name)).toEqual(['Bunny.stl', 'Vase.stl'])
    expect(filterModels(items, '', ['animal', 'cute']).map(f => f.name)).toEqual(['Bunny.stl'])
    expect(filterModels(items, '', ['animal', 'mechanical']).map(f => f.name)).toEqual([])
  })

  it('combines query and tags', () => {
    expect(filterModels(items, 'vase', ['animal']).map(f => f.name)).toEqual(['Vase.stl'])
    expect(filterModels(items, 'gear', ['animal']).map(f => f.name)).toEqual([])
  })

  it('preserves input order', () => {
    expect(filterModels(items, '', ['animal']).map(f => f.name)).toEqual(['Bunny.stl', 'Vase.stl'])
  })
})

describe('allTags', () => {
  it('returns unique tags sorted case-insensitively (natural sort)', () => {
    expect(allTags(items)).toEqual(['animal', 'cute', 'home', 'mechanical'])
  })

  it('dedupes tags across items', () => {
    const dup: Indexed[] = [
      { file: file('a.stl'), tags: ['B', 'a'] },
      { file: file('b.stl'), tags: ['a', 'c'] },
    ]
    expect(allTags(dup)).toEqual(['a', 'B', 'c'])
  })

  it('returns empty array when no items have tags', () => {
    expect(allTags([{ file: file('a.stl'), tags: [] }])).toEqual([])
  })
})
