// Opens a model in Blender. Blender treats any file argument as a .blend, so
// an STL can't simply be passed to it (nor opened via the OS "open with").
// Instead we launch Blender with a small Python startup expression that
// imports the STL into the user's normal startup scene.
//
// The model path is passed AFTER Blender's `--` separator: Blender ignores
// everything after it, and the script reads it back from sys.argv. That keeps
// the script a constant -- no path is ever spliced into Python source, so
// quotes/backslashes/unicode in filenames can't break (or inject into) it.

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

// Runs inside Blender. Keeps the default scene as-is, switches it to
// millimetres (STL units are conventionally mm, matching the Info panel's
// dimensions), imports the model, and -- once the UI is up -- frames every
// 3D viewport on it. `wm.stl_import` is the native importer (Blender 4.1+);
// older versions only have the legacy `import_mesh.stl` add-on operator.
//
// The splash screen would cover the model, and Blender has no CLI flag to
// skip it -- but it decides whether to show it only AFTER this script runs.
// So the splash preference is switched off here and restored (with the
// prefs' dirty flag) from the first timer tick, leaving the user's saved
// preferences untouched.
export const BLENDER_IMPORT_SCRIPT = `
import bpy, sys
path = sys.argv[sys.argv.index('--') + 1]
prefs = bpy.context.preferences
show_splash = prefs.view.show_splash
was_dirty = prefs.is_dirty
prefs.view.show_splash = False

def restore_prefs():
    prefs.view.show_splash = show_splash
    prefs.is_dirty = was_dirty
    return None

bpy.app.timers.register(restore_prefs, first_interval=0.1)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 0.001
scene.unit_settings.length_unit = 'MILLIMETERS'
if hasattr(bpy.ops.wm, 'stl_import'):
    bpy.ops.wm.stl_import(filepath=path)
else:
    bpy.ops.import_mesh.stl(filepath=path)
imported = list(bpy.context.selected_objects)
if imported:
    bpy.context.view_layer.objects.active = imported[0]
    size = max(max(o.dimensions) for o in imported)

    def frame():
        for win in bpy.context.window_manager.windows:
            for area in win.screen.areas:
                if area.type != 'VIEW_3D':
                    continue
                area.spaces.active.clip_end = max(area.spaces.active.clip_end, size * 20)
                region = next((r for r in area.regions if r.type == 'WINDOW'), None)
                if region is None:
                    continue
                with bpy.context.temp_override(window=win, area=area, region=region):
                    bpy.ops.view3d.view_selected()
        return None

    bpy.app.timers.register(frame, first_interval=0.5)
`

export function blenderArgs(stlPath: string): string[] {
  return ['--python-expr', BLENDER_IMPORT_SCRIPT, '--', stlPath]
}

// Everything findBlender touches, injectable so detection is testable on any
// host OS.
export interface BlenderEnv {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  home: string
  exists(p: string): Promise<boolean>
  listDir(p: string): Promise<string[]>
}

async function isFile(p: string): Promise<boolean> {
  try {
    return (await fs.stat(p)).isFile()
  } catch {
    return false
  }
}

const realEnv = (): BlenderEnv => ({
  platform: process.platform,
  env: process.env,
  home: os.homedir(),
  exists: isFile,
  listDir: (p) => fs.readdir(p).catch(() => []),
})

// "Blender 4.10" -> [4, 10], for numeric (not lexical) version ordering.
function versionOf(dirName: string): number[] {
  return (dirName.match(/\d+(\.\d+)*/)?.[0] ?? '0').split('.').map(Number)
}

function compareVersionsDesc(a: string, b: string): number {
  const va = versionOf(a)
  const vb = versionOf(b)
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const d = (vb[i] ?? 0) - (va[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

async function candidates(e: BlenderEnv): Promise<string[]> {
  const out: string[] = []
  if (e.platform === 'darwin') {
    const bin = 'Blender.app/Contents/MacOS/Blender'
    out.push(path.posix.join('/Applications', bin), path.posix.join(e.home, 'Applications', bin))
  } else if (e.platform === 'win32') {
    for (const root of [e.env['ProgramFiles'], e.env['ProgramW6432']]) {
      if (!root) continue
      const foundation = path.win32.join(root, 'Blender Foundation')
      const versions = (await e.listDir(foundation)).filter((d) => /^blender/i.test(d)).sort(compareVersionsDesc)
      for (const v of versions) out.push(path.win32.join(foundation, v, 'blender.exe'))
    }
  }
  const p = e.platform === 'win32' ? path.win32 : path.posix
  const exe = e.platform === 'win32' ? 'blender.exe' : 'blender'
  for (const dir of (e.env['PATH'] ?? '').split(p.delimiter)) {
    if (dir) out.push(p.join(dir, exe))
  }
  return out
}

// Resolves the Blender executable. A non-blank `override` (from Settings) is
// authoritative: if it doesn't exist we throw rather than quietly launching a
// different Blender. A macOS `.app` bundle path resolves to its binary.
export async function findBlender(override: string | null | undefined, e: BlenderEnv = realEnv()): Promise<string | null> {
  const wanted = override?.trim()
  if (wanted) {
    const bin = /\.app\/?$/i.test(wanted) ? path.posix.join(wanted, 'Contents/MacOS/Blender') : wanted
    if (await e.exists(bin)) return bin
    throw new Error(`Blender was not found at "${wanted}". Check the path in Settings.`)
  }
  for (const c of await candidates(e)) {
    if (await e.exists(c)) return c
  }
  return null
}

// Launches Blender detached (it outlives this app and its output is ignored)
// with the model imported. Resolves once the process has started; rejects if
// Blender can't be found or fails to spawn.
export async function openInBlender(stlPath: string, override?: string | null): Promise<void> {
  const bin = await findBlender(override)
  if (!bin) {
    throw new Error('Blender was not found. Install it, or set its location in Settings.')
  }
  await new Promise<void>((resolve, reject) => {
    const child = spawn(bin, blenderArgs(stlPath), { detached: true, stdio: 'ignore' })
    child.once('error', (err) => reject(new Error(`Could not start Blender: ${err.message}`)))
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}
