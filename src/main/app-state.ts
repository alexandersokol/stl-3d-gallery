import { promises as fs } from 'fs'
import path from 'path'
import { app } from 'electron'

interface AppStateFile { lastFolder?: string }

export interface AppState {
  getLastFolder(): Promise<string | null>
  setLastFolder(dir: string): Promise<void>
}

export function makeAppState(baseDir: string): AppState {
  const statePath = path.join(baseDir, 'state.json')

  async function read(): Promise<AppStateFile> {
    try {
      return JSON.parse(await fs.readFile(statePath, 'utf8')) as AppStateFile
    } catch {
      return {}
    }
  }

  return {
    async getLastFolder() {
      const data = await read()
      return data.lastFolder ?? null
    },
    async setLastFolder(dir: string) {
      const data = await read()
      data.lastFolder = dir
      await fs.mkdir(baseDir, { recursive: true })
      await fs.writeFile(statePath, JSON.stringify(data, null, 2))
    },
  }
}

export const appState = makeAppState(app.getPath('userData'))
