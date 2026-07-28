import { promises as fs } from 'fs'; import path from 'path'

// Bump this whenever the thumbnail RENDERER output changes (orientation, color,
// shadow, etc.) so stale cached thumbnails are invalidated and regenerated.
// Start at 2: v1 refers to the unversioned thumbnails already on disk from
// before this scheme existed.
//
// Bumped to 3 when thumbnail rendering gained a selectable material preset
// (the filename now also carries the preset -- see versionedThumbPath below
// -- but the version is still bumped here too since the *builtin* default
// preset/render pipeline changed at the same time).
export const THUMB_RENDER_VERSION = 3

const thumbDir = (modelPath: string) => path.join(path.dirname(modelPath), '.thumb')

// Cache filename carries both the renderer version and the material preset
// used to render it (e.g. `girl.stl.v3_clay.png`), so thumbnails for
// different presets coexist on disk without colliding, and switching the
// configured preset naturally misses the cache (read returns null) and
// regenerates rather than showing a stale/mismatched material.
const versionedThumbPath = (modelPath: string, preset: string, version: number = THUMB_RENDER_VERSION) =>
  path.join(thumbDir(modelPath), `${path.basename(modelPath)}.v${version}_${preset}.png`)

export async function readThumbnail(modelPath: string, preset: string): Promise<Buffer | null> {
  const tp = versionedThumbPath(modelPath, preset)
  try {
    const [ts, ss] = await Promise.all([fs.stat(tp), fs.stat(modelPath)])
    if (ss.mtimeMs > ts.mtimeMs) return null // stale
    return await fs.readFile(tp)
  } catch (e: any) { if (e.code === 'ENOENT') return null; throw e }
}

export async function writeThumbnail(modelPath: string, preset: string, png: Buffer): Promise<void> {
  const dir = thumbDir(modelPath)
  const tp = versionedThumbPath(modelPath, preset)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(tp, png)
  await removeOtherVersions(modelPath, dir, preset)
  await removeLegacyUnversioned(modelPath, dir)
}

// Removes every other cached thumbnail file for this model -- other
// versions (old `<name>.vN.png`) AND other presets at the current version
// (`<name>.vN_<otherPreset>.png`) -- so stale variants never accumulate.
// Both shapes share the `<base>.v` prefix, so a single glob covers both.
async function removeOtherVersions(modelPath: string, dir: string, preset: string): Promise<void> {
  const base = path.basename(modelPath)
  const currentName = path.basename(versionedThumbPath(modelPath, preset))
  const prefix = `${base}.v`
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch (e: any) {
    if (e.code === 'ENOENT') return
    throw e
  }
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix) && name.endsWith('.png') && name !== currentName)
      .map((name) => fs.rm(path.join(dir, name), { force: true }))
  )
}

// Before THUMB_RENDER_VERSION existed, thumbnails were written unversioned
// as `<basename>.png` (e.g. `girl.stl.png`), sitting alongside the model's
// versioned `<basename>.vN.png` file rather than being matched/removed by
// removeOtherVersions' `<basename>.v*` glob. Left alone these orphans
// accumulate forever across upgrades. Remove this model's legacy file (if
// any) whenever a fresh versioned thumbnail is written for it -- scoped to
// this exact basename so other models' files are untouched.
async function removeLegacyUnversioned(modelPath: string, dir: string): Promise<void> {
  const legacyPath = path.join(dir, `${path.basename(modelPath)}.png`)
  await fs.rm(legacyPath, { force: true })
}
