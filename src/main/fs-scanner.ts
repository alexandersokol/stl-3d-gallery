import { promises as fs } from 'fs'
import path from 'path'
import type { ScanResult, FileEntry, FolderEntry } from '../shared/types'
import { HIDDEN_DIRS } from '../shared/paths'

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

export async function scanFolder(dir: string): Promise<ScanResult> {
  const ents = await fs.readdir(dir, { withFileTypes: true })
  const files: FileEntry[] = []
  const folders: FolderEntry[] = []
  for (const e of ents) {
    if (e.isDirectory()) {
      if (!HIDDEN_DIRS.includes(e.name as any)) folders.push({ path: path.join(dir, e.name), name: e.name })
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.stl')) {
      const st = await fs.stat(path.join(dir, e.name))
      files.push({ path: path.join(dir, e.name), name: e.name, size: st.size, mtimeMs: st.mtimeMs })
    }
  }
  files.sort((a, b) => byName(a.name, b.name))
  folders.sort((a, b) => byName(a.name, b.name))
  return { folders, files }
}

export async function scanTree(dir: string): Promise<FileEntry[]> {
  // Let a missing/unreadable top-level dir reject as usual.
  const ents = await fs.readdir(dir, { withFileTypes: true })
  const files: FileEntry[] = []
  for (const e of ents) {
    if (e.isDirectory()) {
      if (HIDDEN_DIRS.includes(e.name as any)) continue
      try {
        files.push(...(await scanTree(path.join(dir, e.name))))
      } catch {
        // Skip a subdirectory we can't read; don't fail the whole walk.
      }
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.stl')) {
      const full = path.join(dir, e.name)
      const st = await fs.stat(full)
      files.push({ path: full, name: e.name, size: st.size, mtimeMs: st.mtimeMs })
    }
  }
  files.sort((a, b) => byName(a.path, b.path))
  return files
}
