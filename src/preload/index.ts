import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

// Only the typed `api` surface below is exposed to the renderer. Never
// expose `ipcRenderer` (or any other Node/Electron primitive) directly —
// that would let renderer code send/listen on arbitrary IPC channels and
// defeat contextIsolation/sandbox.
const api: Api = {
  openFolderDialog: () => ipcRenderer.invoke('openFolderDialog'),
  scanFolder: (dir) => ipcRenderer.invoke('scanFolder', dir),
  scanTree: (dir) => ipcRenderer.invoke('scanTree', dir),
  readFileBytes: (p) => ipcRenderer.invoke('readFileBytes', p),
  readMetadata: (model) => ipcRenderer.invoke('readMetadata', model),
  readMetadataBatch: (paths) => ipcRenderer.invoke('readMetadataBatch', paths),
  writeMetadata: (model, data) => ipcRenderer.invoke('writeMetadata', model, data),
  readThumbnail: (model, preset) => ipcRenderer.invoke('readThumbnail', model, preset),
  writeThumbnail: (model, preset, png) => ipcRenderer.invoke('writeThumbnail', model, preset, png),
  readLinkedImage: (model) => ipcRenderer.invoke('readLinkedImage', model),
  writeLinkedImage: (model, bytes, ext) => ipcRenderer.invoke('writeLinkedImage', model, bytes, ext),
  removeLinkedImage: (model) => ipcRenderer.invoke('removeLinkedImage', model),
  renameModel: (model, newName) => ipcRenderer.invoke('renameModel', model, newName),
  copyModel: (model, newName) => ipcRenderer.invoke('copyModel', model, newName),
  moveModel: (model) => ipcRenderer.invoke('moveModel', model),
  deleteModel: (model) => ipcRenderer.invoke('deleteModel', model),
  writeStlFile: (model, bytes) => ipcRenderer.invoke('writeStlFile', model, bytes),
  getLastFolder: () => ipcRenderer.invoke('getLastFolder'),
  setLastFolder: (dir) => ipcRenderer.invoke('setLastFolder', dir),
  onOpenFile: (cb) => ipcRenderer.on('open-file', (_e, path: string) => cb(path)),
  getStartupFolder: () => ipcRenderer.invoke('getStartupFolder'),
}

contextBridge.exposeInMainWorld('api', api)
