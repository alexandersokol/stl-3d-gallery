import { describe, it, expect, beforeEach, vi } from 'vitest'
import { promises as fs } from 'fs'; import os from 'os'; import path from 'path'

// app-state.ts also exports an eager singleton built from
// `app.getPath('userData')`. Outside a real Electron process 'electron'
// resolves to a stub with no `app` export, so importing the module would
// throw at import time. Mock it so this file can exercise the pure
// `makeAppState` factory (the only thing under test here) in plain Node.
vi.mock('electron', () => ({ app: { getPath: () => '/unused-in-tests' } }))

import { makeAppState } from './app-state'

let dir: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'app-state-')) })

describe('app-state', () => {
  it('returns null when no state file exists', async () => {
    const state = makeAppState(dir)
    expect(await state.getLastFolder()).toBeNull()
  })

  it('persists and returns the last folder', async () => {
    const state = makeAppState(dir)
    await state.setLastFolder('/some/path')
    expect(await state.getLastFolder()).toBe('/some/path')
  })

  it('returns null (does not throw) when state.json is corrupt', async () => {
    await fs.writeFile(path.join(dir, 'state.json'), '{ not valid json')
    const state = makeAppState(dir)
    expect(await state.getLastFolder()).toBeNull()
  })
})
