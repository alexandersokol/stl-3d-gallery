import { ipcMain, dialog } from 'electron'
import { promises as fs } from 'fs'
import { scanFolder, scanTree } from './fs-scanner'
import { readMetadata, writeMetadata, readMetadataBatch } from './metadata-store'
import { readThumbnail, writeThumbnail } from './thumbnail-cache'
import { readLinkedImage, writeLinkedImage, removeLinkedImage } from './linked-image-store'
import { appState } from './app-state'
import { parseStartupFolder } from './startup-args'
import type { Metadata } from '../shared/types'

// Node Buffers share a pooled backing ArrayBuffer, so `buf.buffer` alone can
// expose unrelated memory beyond this buffer's bytes. Slice to the buffer's
// own byteOffset/byteLength to get an ArrayBuffer that contains exactly (and
// only) this buffer's data before sending it across the IPC boundary.
function toArrayBuffer(buf: Buffer): ArrayBuffer {
  // Buffer.buffer is typed as ArrayBufferLike (ArrayBuffer | SharedArrayBuffer)
  // but Node Buffers are always backed by a plain ArrayBuffer in practice.
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

export function registerIpc(): void {
  ipcMain.handle('openFolderDialog', async () => {
    const { filePaths, canceled } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled || filePaths.length === 0 ? null : filePaths[0]
  })

  ipcMain.handle('scanFolder', async (_e, dir: string) => {
    return scanFolder(dir)
  })

  ipcMain.handle('scanTree', async (_e, dir: string) => {
    return scanTree(dir)
  })

  ipcMain.handle('readFileBytes', async (_e, p: string) => {
    const buf = await fs.readFile(p)
    return toArrayBuffer(buf)
  })

  ipcMain.handle('readMetadata', async (_e, model: string) => {
    return readMetadata(model)
  })

  ipcMain.handle('readMetadataBatch', async (_e, paths: string[]) => {
    return readMetadataBatch(paths)
  })

  ipcMain.handle('writeMetadata', async (_e, model: string, data: Partial<Metadata>) => {
    return writeMetadata(model, data)
  })

  ipcMain.handle('readThumbnail', async (_e, model: string) => {
    const buf = await readThumbnail(model)
    return buf ? toArrayBuffer(buf) : null
  })

  ipcMain.handle('writeThumbnail', async (_e, model: string, png: ArrayBuffer) => {
    await writeThumbnail(model, Buffer.from(png))
  })

  ipcMain.handle('readLinkedImage', async (_e, model: string) => {
    const res = await readLinkedImage(model)
    return res ? { bytes: toArrayBuffer(res.bytes), name: res.name } : null
  })

  ipcMain.handle('writeLinkedImage', async (_e, model: string, bytes: ArrayBuffer, ext: string) => {
    return writeLinkedImage(model, Buffer.from(bytes), ext)
  })

  ipcMain.handle('removeLinkedImage', async (_e, model: string) => {
    await removeLinkedImage(model)
  })

  ipcMain.handle('getLastFolder', async () => {
    return appState.getLastFolder()
  })

  ipcMain.handle('setLastFolder', async (_e, dir: string) => {
    await appState.setLastFolder(dir)
  })

  // Lets the E2E harness (Task 8.1) point a launched build at a fixture
  // folder deterministically via `--folder <path>`, cross-platform, without
  // relying on OS file-association plumbing. Absent in normal use, so this
  // is a no-op (returns null) for real users.
  ipcMain.handle('getStartupFolder', async () => {
    return parseStartupFolder(process.argv)
  })
}
