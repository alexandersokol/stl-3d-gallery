import { contextBridge } from 'electron'
contextBridge.exposeInMainWorld('api', {}) // filled in Phase 1
