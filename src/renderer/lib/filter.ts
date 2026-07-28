import type { FileEntry } from '../../shared/types'

export interface Indexed {
  file: FileEntry
  tags: string[]
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

export function filterModels(items: Indexed[], q: string, activeTags: string[]): FileEntry[] {
  const needle = q.toLowerCase()
  return items
    .filter(item => item.file.name.toLowerCase().includes(needle))
    .filter(item => activeTags.every(tag => item.tags.includes(tag)))
    .map(item => item.file)
}

export function allTags(items: Indexed[]): string[] {
  const set = new Set<string>()
  for (const item of items) {
    for (const tag of item.tags) set.add(tag)
  }
  return Array.from(set).sort(byName)
}
