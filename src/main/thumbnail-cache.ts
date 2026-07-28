import { promises as fs } from 'fs'; import path from 'path'

// Bump this whenever the thumbnail RENDERER output changes (orientation, color,
// shadow, etc.) so stale cached thumbnails are invalidated and regenerated.
// Start at 2: v1 refers to the unversioned thumbnails already on disk from
// before this scheme existed.
export const THUMB_RENDER_VERSION = 2

const thumbDir = (modelPath: string) => path.join(path.dirname(modelPath), '.thumb')

const versionedThumbPath = (modelPath: string, version: number = THUMB_RENDER_VERSION) =>
  path.join(thumbDir(modelPath), `${path.basename(modelPath)}.v${version}.png`)

export async function readThumbnail(modelPath: string): Promise<Buffer | null> {
  const tp = versionedThumbPath(modelPath)
  try {
    const [ts, ss] = await Promise.all([fs.stat(tp), fs.stat(modelPath)])
    if (ss.mtimeMs > ts.mtimeMs) return null // stale
    return await fs.readFile(tp)
  } catch (e: any) { if (e.code === 'ENOENT') return null; throw e }
}

export async function writeThumbnail(modelPath: string, png: Buffer): Promise<void> {
  const dir = thumbDir(modelPath)
  const tp = versionedThumbPath(modelPath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(tp, png)
  await removeOtherVersions(modelPath, dir)
  await removeLegacyUnversioned(modelPath, dir)
}

async function removeOtherVersions(modelPath: string, dir: string): Promise<void> {
  const base = path.basename(modelPath)
  const currentName = path.basename(versionedThumbPath(modelPath))
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
