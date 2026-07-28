// File operations on a model that also carry its sidecar files (metadata,
// thumbnails, linked image). Every sidecar is named `<model-basename><suffix>`
// and lives in a hidden sibling dir (.meta/.thumb/.linked), so a single
// generic routine handles them all by swapping the basename prefix.
//
// These are the authoritative, disk-touching operations; the renderer calls
// them via IPC. Filename validation is shared with the renderer dialog (see
// shared/filename) and re-checked here before anything is written.

import { promises as fs } from 'fs'
import path from 'path'
import { shell } from 'electron'
import { HIDDEN_DIRS } from '../shared/paths'
import { validateStlFilename } from '../shared/filename'
import { readMetadata, writeMetadata } from './metadata-store'
import type { FileOpResult } from '../shared/types'

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.stat(p)
    return true
  } catch (e: any) {
    if (e.code === 'ENOENT') return false
    throw e
  }
}

interface Sidecar {
  hiddenDir: string // e.g. '.thumb'
  entry: string // filename within that dir, e.g. 'girl.stl.v6_studio.png'
}

// Every existing sidecar file for `<dir>/<base>`: any file inside a hidden
// sibling dir whose name starts with `<base>.` (meta json, thumbnail PNGs,
// linked image). `base` always ends in `.stl`, so this prefix can't match a
// different model's sidecars.
async function listSidecars(dir: string, base: string): Promise<Sidecar[]> {
  const prefix = base + '.'
  const out: Sidecar[] = []
  for (const hiddenDir of HIDDEN_DIRS) {
    let entries: string[]
    try {
      entries = await fs.readdir(path.join(dir, hiddenDir))
    } catch (e: any) {
      if (e.code === 'ENOENT') continue
      throw e
    }
    for (const entry of entries) {
      if (entry.startsWith(prefix)) out.push({ hiddenDir, entry })
    }
  }
  return out
}

// Moves a single file, falling back to copy+unlink when src and dest live on
// different filesystems (fs.rename throws EXDEV in that case).
async function moveFile(src: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true })
  try {
    await fs.rename(src, dest)
  } catch (e: any) {
    if (e.code !== 'EXDEV') throw e
    await fs.copyFile(src, dest)
    await fs.rm(src, { force: true })
  }
}

async function copyFileTo(src: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.copyFile(src, dest)
}

// New sidecar entry name after the model basename changes (rename/copy).
function reprefix(entry: string, oldBase: string, newBase: string): string {
  return newBase + entry.slice(oldBase.length)
}

// After a rename/copy, the (already moved/copied) metadata at newModelPath
// still points `linkedImage` at the OLD linked filename. Rewrite it to match
// the new basename so the reference resolves.
async function fixLinkedImageReference(
  newModelPath: string,
  oldBase: string,
  newBase: string,
): Promise<void> {
  const meta = await readMetadata(newModelPath)
  if (meta?.linkedImage && meta.linkedImage.startsWith(oldBase)) {
    await writeMetadata(newModelPath, { linkedImage: reprefix(meta.linkedImage, oldBase, newBase) })
  }
}

async function renameOrCopy(
  modelPath: string,
  newName: string,
  op: 'rename' | 'copy',
): Promise<FileOpResult> {
  const validation = validateStlFilename(newName)
  if (!validation.ok) throw new Error(validation.error)

  const dir = path.dirname(modelPath)
  const oldBase = path.basename(modelPath)
  const newBase = newName.trim()
  const newModelPath = path.join(dir, newBase)

  if (op === 'rename' && newBase === oldBase) return { path: modelPath } // no-op

  if (await pathExists(newModelPath)) {
    throw new Error(`A file named "${newBase}" already exists in this folder.`)
  }

  const sidecars = await listSidecars(dir, oldBase)
  const transfer = op === 'rename' ? moveFile : copyFileTo

  await transfer(modelPath, newModelPath)
  for (const { hiddenDir, entry } of sidecars) {
    const src = path.join(dir, hiddenDir, entry)
    const dest = path.join(dir, hiddenDir, reprefix(entry, oldBase, newBase))
    await transfer(src, dest)
  }

  await fixLinkedImageReference(newModelPath, oldBase, newBase)
  return { path: newModelPath }
}

export function renameModel(modelPath: string, newName: string): Promise<FileOpResult> {
  return renameOrCopy(modelPath, newName, 'rename')
}

export function copyModel(modelPath: string, newName: string): Promise<FileOpResult> {
  return renameOrCopy(modelPath, newName, 'copy')
}

// Moves the model (keeping its name) into `targetDir`, carrying its sidecars
// into that folder's hidden dirs. The name is unchanged, so no metadata edit
// is needed. The native folder picker is opened by the IPC handler, which
// passes the chosen directory here.
export async function moveModel(modelPath: string, targetDir: string): Promise<FileOpResult> {
  const dir = path.dirname(modelPath)
  const base = path.basename(modelPath)

  if (path.resolve(targetDir) === path.resolve(dir)) {
    throw new Error('The model is already in that folder.')
  }

  const newModelPath = path.join(targetDir, base)
  if (await pathExists(newModelPath)) {
    throw new Error(`A file named "${base}" already exists in the destination folder.`)
  }

  const sidecars = await listSidecars(dir, base)

  await moveFile(modelPath, newModelPath)
  for (const { hiddenDir, entry } of sidecars) {
    await moveFile(path.join(dir, hiddenDir, entry), path.join(targetDir, hiddenDir, entry))
  }

  return { path: newModelPath }
}

// Writes repaired STL bytes next to the source model as `<name>-fixed.stl`,
// bumping to `-fixed-2.stl`, `-fixed-3.stl`, … if a name is already taken, so
// a repaired file never clobbers an existing one. The source is left
// untouched; the new file has no sidecars (a fresh thumbnail regenerates on
// first view). Returns the new model path.
export async function writeRepairedModel(
  sourceModelPath: string,
  bytes: ArrayBuffer,
): Promise<FileOpResult> {
  const dir = path.dirname(sourceModelPath)
  const base = path.basename(sourceModelPath)
  const stem = base.toLowerCase().endsWith('.stl') ? base.slice(0, -4) : base

  let target = path.join(dir, `${stem}-fixed.stl`)
  for (let n = 2; await pathExists(target); n++) {
    target = path.join(dir, `${stem}-fixed-${n}.stl`)
  }

  await fs.writeFile(target, Buffer.from(bytes))
  return { path: target }
}

// Moves the model and every sidecar to the OS trash (recoverable). Missing
// files are skipped rather than failing the whole delete.
export async function deleteModel(modelPath: string): Promise<void> {
  const dir = path.dirname(modelPath)
  const base = path.basename(modelPath)
  const sidecars = await listSidecars(dir, base)

  const targets = [
    ...sidecars.map(({ hiddenDir, entry }) => path.join(dir, hiddenDir, entry)),
    modelPath,
  ]
  for (const target of targets) {
    try {
      await shell.trashItem(target)
    } catch (err) {
      if (await pathExists(target)) throw err // real failure, not just "already gone"
    }
  }
}
