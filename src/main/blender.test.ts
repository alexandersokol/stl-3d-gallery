import { describe, it, expect } from 'vitest'
import path from 'path'
import { findBlender, blenderArgs, BLENDER_IMPORT_SCRIPT, type BlenderEnv } from './blender'

// Fake filesystem: `files` are paths that exist; `dirs` maps a directory to
// its entries. Paths are compared verbatim, so each test builds them with
// the same separator the code under test will use for that platform.
function env(over: Partial<BlenderEnv> & { files?: string[]; dirs?: Record<string, string[]> }): BlenderEnv {
  const files = new Set(over.files ?? [])
  const dirs = over.dirs ?? {}
  return {
    platform: over.platform ?? 'darwin',
    env: over.env ?? {},
    home: over.home ?? '/Users/me',
    exists: over.exists ?? (async (p) => files.has(p)),
    listDir: over.listDir ?? (async (p) => dirs[p] ?? []),
  }
}

const MAC_BIN = '/Applications/Blender.app/Contents/MacOS/Blender'

describe('findBlender', () => {
  it('finds the standard macOS install', async () => {
    expect(await findBlender(null, env({ files: [MAC_BIN] }))).toBe(MAC_BIN)
  })

  it('falls back to ~/Applications on macOS', async () => {
    const userBin = '/Users/me/Applications/Blender.app/Contents/MacOS/Blender'
    expect(await findBlender(null, env({ files: [userBin] }))).toBe(userBin)
  })

  it('picks the highest installed version under Program Files on Windows', async () => {
    const root = path.win32.join('C:\\Program Files', 'Blender Foundation')
    const newest = path.win32.join(root, 'Blender 5.2', 'blender.exe')
    const e = env({
      platform: 'win32',
      env: { ProgramFiles: 'C:\\Program Files' },
      dirs: { [root]: ['Blender 4.2', 'Blender 5.2', 'Blender 3.6'] },
      files: [path.win32.join(root, 'Blender 4.2', 'blender.exe'), newest, path.win32.join(root, 'Blender 3.6', 'blender.exe')],
    })
    expect(await findBlender(null, e)).toBe(newest)
  })

  it('compares Windows versions numerically, not lexically', async () => {
    const root = path.win32.join('C:\\Program Files', 'Blender Foundation')
    const v10 = path.win32.join(root, 'Blender 4.10', 'blender.exe')
    const e = env({
      platform: 'win32',
      env: { ProgramFiles: 'C:\\Program Files' },
      dirs: { [root]: ['Blender 4.10', 'Blender 4.9'] },
      files: [v10, path.win32.join(root, 'Blender 4.9', 'blender.exe')],
    })
    expect(await findBlender(null, e)).toBe(v10)
  })

  it('searches PATH when no standard install exists', async () => {
    const e = env({ platform: 'linux', env: { PATH: '/usr/bin:/opt/blender' }, files: ['/opt/blender/blender'] })
    expect(await findBlender(null, e)).toBe('/opt/blender/blender')
  })

  it('returns null when Blender is nowhere to be found', async () => {
    expect(await findBlender(null, env({ env: { PATH: '/usr/bin' } }))).toBeNull()
  })

  it('uses an existing override path instead of auto-detection', async () => {
    const custom = '/opt/b/blender'
    expect(await findBlender(custom, env({ files: [custom, MAC_BIN] }))).toBe(custom)
  })

  it('resolves an override pointing at a macOS .app bundle to its binary', async () => {
    const app = '/Users/me/Tools/Blender 5.2.app'
    const bin = path.posix.join(app, 'Contents/MacOS/Blender')
    expect(await findBlender(app, env({ files: [bin] }))).toBe(bin)
  })

  it('throws when an override is set but missing, rather than silently auto-detecting', async () => {
    await expect(findBlender('/nope/blender', env({ files: [MAC_BIN] }))).rejects.toThrow(/\/nope\/blender/)
  })

  it('treats a blank override as unset', async () => {
    expect(await findBlender('   ', env({ files: [MAC_BIN] }))).toBe(MAC_BIN)
  })
})

describe('blenderArgs', () => {
  it('passes the STL path after "--" so Blender ignores it and the script reads it', () => {
    const p = '/models/my "weird" mödel\\.stl'
    expect(blenderArgs(p)).toEqual(['--python-expr', BLENDER_IMPORT_SCRIPT, '--', p])
  })
})

describe('BLENDER_IMPORT_SCRIPT', () => {
  it('reads the model path from argv after "--" and never embeds it', () => {
    expect(BLENDER_IMPORT_SCRIPT).toContain("sys.argv[sys.argv.index('--') + 1]")
  })

  it('hides the splash for this launch only, restoring the preference afterwards', () => {
    expect(BLENDER_IMPORT_SCRIPT).toContain('prefs.view.show_splash = False')
    expect(BLENDER_IMPORT_SCRIPT).toContain('prefs.view.show_splash = show_splash')
    expect(BLENDER_IMPORT_SCRIPT).toContain('prefs.is_dirty = was_dirty')
  })

  it('sets the scene to millimetres', () => {
    expect(BLENDER_IMPORT_SCRIPT).toContain('scale_length = 0.001')
    expect(BLENDER_IMPORT_SCRIPT).toContain("length_unit = 'MILLIMETERS'")
  })

  it('imports with the native importer and falls back to the legacy add-on', () => {
    expect(BLENDER_IMPORT_SCRIPT).toContain('bpy.ops.wm.stl_import')
    expect(BLENDER_IMPORT_SCRIPT).toContain('bpy.ops.import_mesh.stl')
  })
})
