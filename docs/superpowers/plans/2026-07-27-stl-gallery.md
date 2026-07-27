# STL Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline Electron desktop app that browses folders of STL files like an image gallery, previews each model in an interactive 3D viewer, and stores portable per-model tags, notes, and a linked reference image.

**Architecture:** Secure Electron split — a **main** process owns all filesystem/native work and exposes a small typed `contextBridge` API; a **renderer** React app owns all UI, the three.js viewer, and Web Workers. Metadata, thumbnails, and linked images are stored in sibling hidden folders (`.meta/`, `.thumb/`, `.linked/`) so they travel with the models. Heavy work (STL parsing, thumbnail rendering) runs off the UI thread.

**Tech Stack:** Electron, TypeScript, React, Vite (via `electron-vite`), three.js, Zustand, Vitest, React Testing Library, Playwright (Electron), electron-builder.

## Global Constraints

- **Node** ≥ 20 (dev machine has v22.3.0). **Package manager:** npm.
- **Electron security:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Renderer touches the filesystem **only** through the preload API — never `require`/`fs`.
- **Formats:** STL only (binary + ASCII). No other 3D formats.
- **Storage layout (exact):** for `<dir>/<name>.stl` → metadata `<dir>/.meta/<name>.stl.json`, thumbnail `<dir>/.thumb/<name>.stl.png`, linked image `<dir>/.linked/<name>.stl.<ext>`. These three folders are created lazily and never listed as content.
- **Units:** STL is unitless; display bounding-box dimensions as **mm** (display-only, no scaling).
- **Offline-first:** no runtime network calls. Icons (Google Fonts Material Symbols) are downloaded once and committed under `src/renderer/assets/icons/`; PBR environment is three.js `RoomEnvironment` (procedural, no HDRI asset).
- **Linked image:** exactly one per model in v1; attach replaces, detach deletes. Accepted types: png, jpg/jpeg, webp, gif; clipboard paste saved as `.png`.
- **TDD:** every logic task writes a failing test first. **Commit** after each task.
- **Source-of-truth spec:** `wiki/_INDEX.md` and linked docs.

---

## File Structure

```
stl-gallery/
├── package.json
├── electron.vite.config.ts          # electron-vite: main / preload / renderer builds
├── electron-builder.yml             # packaging + fileAssociations (.stl)
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json  tsconfig.node.json
├── src/
│   ├── shared/
│   │   ├── paths.ts                 # model path → .meta/.thumb/.linked path mapping (PURE)
│   │   └── types.ts                 # FileEntry, FolderEntry, Metadata, ScanResult, ModelStats
│   ├── main/
│   │   ├── index.ts                 # app lifecycle, window, open-file/argv handling
│   │   ├── window.ts                # BrowserWindow factory (security options)
│   │   ├── ipc.ts                   # registers all ipcMain handlers
│   │   ├── fs-scanner.ts            # scan a dir → folders + stl files (+stat)
│   │   ├── metadata-store.ts        # read/write .meta/*.json
│   │   ├── thumbnail-cache.ts       # read/write .thumb/*.png (mtime staleness)
│   │   ├── linked-image-store.ts    # read/write/delete .linked/*
│   │   └── app-state.ts             # persist last-opened folder (electron app userData)
│   ├── preload/
│   │   └── index.ts                 # contextBridge `window.api`
│   └── renderer/
│       ├── index.html  main.tsx  App.tsx
│       ├── assets/icons/            # committed Material Symbols SVGs
│       ├── state/store.ts           # Zustand store
│       ├── ipc/api.ts               # typed wrapper around window.api
│       ├── lib/
│       │   ├── stl-parser.ts        # PURE parse ArrayBuffer → {positions, triCount, bbox}
│       │   └── filter.ts            # PURE search + tag filter over entries+metadata
│       ├── workers/stl.worker.ts    # runs stl-parser off-thread
│       ├── viewer/
│       │   ├── SceneManager.ts      # three.js scene/renderer/camera lifecycle
│       │   ├── materials.ts         # material preset factory (PURE-ish)
│       │   ├── lighting.ts          # lighting preset factory
│       │   ├── cameraControls.ts    # OrbitControls + fitToObject
│       │   └── thumbnailer.ts       # offscreen render geometry → PNG blob
│       └── components/
│           ├── TopBar.tsx  Breadcrumbs.tsx  SearchBox.tsx  TagFilterBar.tsx
│           ├── GridView.tsx  ModelTile.tsx  FolderTile.tsx
│           ├── Filmstrip.tsx  Viewer.tsx  ViewerToolbar.tsx
│           ├── InfoPanel.tsx  TagEditor.tsx  ReferenceImage.tsx
│           └── EmptyState.tsx
└── tests/fixtures/                  # tiny binary+ascii STL cubes, a nested folder
```

**Design rule:** `src/shared/*` and `src/renderer/lib/*` are pure (no Electron, no DOM, no three.js side effects) so they unit-test trivially and run in both processes/workers.

---

## Phase 0 — Scaffold & app shell

### Task 0.1: Project scaffold with electron-vite + React + TS

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `src/main/index.ts`, `src/main/window.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/main.tsx`, `src/renderer/App.tsx`
- Create: `.editorconfig`

**Interfaces:**
- Produces: a launchable Electron app; `createWindow()` in `window.ts`.

- [ ] **Step 1: Init and install deps**

```bash
npm init -y
npm i three zustand
npm i -D electron electron-vite vite @vitejs/plugin-react typescript \
  @types/node @types/three react react-dom @types/react @types/react-dom \
  vitest @testing-library/react @testing-library/user-event jsdom \
  @playwright/test electron-builder
```
> `react` / `react-dom` are runtime deps; move them if `npm` placed them in devDeps.

- [ ] **Step 2: Write `electron.vite.config.ts`**

```ts
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: { build: { rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') } } },
  preload: { build: { rollupOptions: { input: resolve(__dirname, 'src/preload/index.ts') } } },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: { rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') } },
    worker: { format: 'es' },
  },
})
```

- [ ] **Step 3: Write `src/main/window.ts` (security options)**

```ts
import { BrowserWindow, shell } from 'electron'
import { join } from 'path'

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280, height: 820, show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  return win
}
```

- [ ] **Step 4: Write `src/main/index.ts`, `src/preload/index.ts` (stub), renderer entry + a "Hello" App**

`src/main/index.ts`:
```ts
import { app, BrowserWindow } from 'electron'
import { createWindow } from './window'

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
```

`src/preload/index.ts`:
```ts
import { contextBridge } from 'electron'
contextBridge.exposeInMainWorld('api', {}) // filled in Phase 1
```

`src/renderer/App.tsx`:
```tsx
export default function App() { return <div className="app">STL Gallery</div> }
```
(`main.tsx` mounts `<App/>` into `#root`; `index.html` has `<div id="root"></div>` and a module script to `main.tsx`.)

- [ ] **Step 5: Add npm scripts**

In `package.json`: `"dev": "electron-vite dev"`, `"build": "electron-vite build"`, `"test": "vitest run"`, `"test:watch": "vitest"`, `"e2e": "playwright test"`. Set `"main": "out/main/index.js"`.

- [ ] **Step 6: Run the app**

Run: `npm run dev`
Expected: an Electron window opens showing "STL Gallery". Close it.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold electron-vite + react + ts app shell"
```

### Task 0.2: Test tooling + fixtures

**Files:**
- Create: `vitest.config.ts`, `tests/fixtures/make-fixtures.mjs`, generated `tests/fixtures/cube-bin.stl`, `tests/fixtures/cube-ascii.stl`, and nested `tests/fixtures/tree/{a.stl,sub/b.stl}`

**Interfaces:**
- Produces: Vitest configured (node + jsdom envs); STL fixtures used by later parser/scanner tests.

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['**/*.dom.test.{ts,tsx}', 'jsdom']],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Write `tests/fixtures/make-fixtures.mjs`** — generates a unit cube as binary + ASCII STL and the nested tree. (Cube = 12 triangles; use standard STL layout: 80-byte header, uint32 count, then 50 bytes/triangle for binary.)

```js
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

// 12 triangles of a unit cube (0..1). Minimal, normals zeroed.
const tris = [/* 12 [ax,ay,az, bx,by,bz, cx,cy,cz] triangles of a 1mm cube */]
// (Implementer: generate the 12 triangles programmatically from the 8 corners.)

function bin(tris) {
  const buf = Buffer.alloc(84 + tris.length * 50)
  buf.writeUInt32LE(tris.length, 80)
  let o = 84
  for (const t of tris) { o += 12; for (const v of t) { buf.writeFloatLE(v, o); o += 4 } o += 2 }
  return buf
}
function ascii(tris) {
  let s = 'solid cube\n'
  for (const t of tris) {
    s += ' facet normal 0 0 0\n  outer loop\n'
    for (let i = 0; i < 9; i += 3) s += `   vertex ${t[i]} ${t[i+1]} ${t[i+2]}\n`
    s += '  endloop\n endfacet\n'
  }
  return s + 'endsolid cube\n'
}
const here = dirname(new URL(import.meta.url).pathname)
writeFileSync(join(here, 'cube-bin.stl'), bin(tris))
writeFileSync(join(here, 'cube-ascii.stl'), ascii(tris))
mkdirSync(join(here, 'tree/sub'), { recursive: true })
writeFileSync(join(here, 'tree/a.stl'), bin(tris))
writeFileSync(join(here, 'tree/sub/b.stl'), bin(tris))
```

- [ ] **Step 3: Generate fixtures & sanity-run vitest**

Run: `node tests/fixtures/make-fixtures.mjs && npx vitest run`
Expected: fixtures written; vitest runs with "no tests" (or 0 failures).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "test: add vitest config and STL fixtures"
```

---

## Phase 1 — Shared types & main-process file core (pure/TDD-heavy)

### Task 1.1: Shared types

**Files:** Create `src/shared/types.ts`

**Interfaces — Produces:**
```ts
export interface FileEntry { path: string; name: string; size: number; mtimeMs: number }
export interface FolderEntry { path: string; name: string }
export interface ScanResult { folders: FolderEntry[]; files: FileEntry[] }
export interface Metadata { schemaVersion: 1; tags: string[]; notes: string; linkedImage?: string; updatedAt: string }
export interface ModelStats { triCount: number; vertCount: number; bbox: { x: number; y: number; z: number } }
```

- [ ] **Step 1:** Write the file above. No test (types only).
- [ ] **Step 2: Commit** `git add -A && git commit -m "feat: shared domain types"`

### Task 1.2: Path mapping (`src/shared/paths.ts`) — PURE

**Files:** Create `src/shared/paths.ts`, `src/shared/paths.test.ts`

**Interfaces — Produces:**
```ts
export function metaPath(modelPath: string): string
export function thumbPath(modelPath: string): string
export function linkedPath(modelPath: string, ext: string): string // ext without dot
export const HIDDEN_DIRS: readonly string[] // ['.meta','.thumb','.linked']
```

- [ ] **Step 1: Write failing tests** `src/shared/paths.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { metaPath, thumbPath, linkedPath, HIDDEN_DIRS } from './paths'

describe('paths', () => {
  const m = '/prints/dragons/123.stl'
  it('maps metadata', () => expect(metaPath(m)).toBe('/prints/dragons/.meta/123.stl.json'))
  it('maps thumbnail', () => expect(thumbPath(m)).toBe('/prints/dragons/.thumb/123.stl.png'))
  it('maps linked image with ext', () => expect(linkedPath(m, 'png')).toBe('/prints/dragons/.linked/123.stl.png'))
  it('lists hidden dirs', () => expect(HIDDEN_DIRS).toEqual(['.meta', '.thumb', '.linked']))
})
```

- [ ] **Step 2: Run — expect FAIL** `npx vitest run src/shared/paths.test.ts`
- [ ] **Step 3: Implement `paths.ts`**

```ts
import path from 'path'
export const HIDDEN_DIRS = ['.meta', '.thumb', '.linked'] as const
const sib = (modelPath: string, dir: string, suffix: string) => {
  const d = path.dirname(modelPath), base = path.basename(modelPath)
  return path.join(d, dir, base + suffix)
}
export const metaPath = (m: string) => sib(m, '.meta', '.json')
export const thumbPath = (m: string) => sib(m, '.thumb', '.png')
export const linkedPath = (m: string, ext: string) => sib(m, '.linked', '.' + ext)
```
> Tests assert POSIX separators; on Windows `path.join` yields `\`. Use `path.posix` in tests or normalize. Implementer: write tests with `path.join`-built expectations so they pass cross-platform.

- [ ] **Step 4: Run — expect PASS.** Adjust expected strings to `path.join` form if needed.
- [ ] **Step 5: Commit** `git commit -am "feat: sibling path mapping for meta/thumb/linked"`

### Task 1.3: `fs-scanner.ts`

**Files:** Create `src/main/fs-scanner.ts`, `src/main/fs-scanner.test.ts`

**Interfaces — Produces:** `export async function scanFolder(dir: string): Promise<ScanResult>`
- Lists immediate children only. `files` = entries ending `.stl` (case-insensitive) with `size`+`mtimeMs` from stat, sorted by name (natural, case-insensitive). `folders` = subdirectories excluding `HIDDEN_DIRS`, sorted by name.

- [ ] **Step 1: Write failing tests** using `tests/fixtures/tree`

```ts
import { describe, it, expect } from 'vitest'
import { scanFolder } from './fs-scanner'
import path from 'path'
const tree = path.resolve(__dirname, '../../tests/fixtures/tree')

describe('scanFolder', () => {
  it('lists stl files with stat', async () => {
    const r = await scanFolder(tree)
    expect(r.files.map(f => f.name)).toEqual(['a.stl'])
    expect(r.files[0].size).toBeGreaterThan(0)
    expect(r.files[0].mtimeMs).toBeGreaterThan(0)
  })
  it('lists subfolders and excludes hidden dirs', async () => {
    const r = await scanFolder(tree)
    expect(r.folders.map(f => f.name)).toContain('sub')
    expect(r.folders.map(f => f.name)).not.toContain('.meta')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement**

```ts
import { promises as fs } from 'fs'
import path from 'path'
import type { ScanResult } from '../shared/types'
import { HIDDEN_DIRS } from '../shared/paths'

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

export async function scanFolder(dir: string): Promise<ScanResult> {
  const ents = await fs.readdir(dir, { withFileTypes: true })
  const files = [], folders = []
  for (const e of ents) {
    if (e.isDirectory()) {
      if (!HIDDEN_DIRS.includes(e.name as any)) folders.push({ path: path.join(dir, e.name), name: e.name })
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.stl')) {
      const st = await fs.stat(path.join(dir, e.name))
      files.push({ path: path.join(dir, e.name), name: e.name, size: st.size, mtimeMs: st.mtimeMs })
    }
  }
  files.sort((a, b) => byName(a.name, b.name)); folders.sort((a, b) => byName(a.name, b.name))
  return { folders, files }
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `git commit -am "feat: fs-scanner lists stl files and subfolders"`

### Task 1.4: `metadata-store.ts`

**Files:** Create `src/main/metadata-store.ts`, `src/main/metadata-store.test.ts`

**Interfaces — Produces:**
```ts
export async function readMetadata(modelPath: string): Promise<Metadata | null>
export async function writeMetadata(modelPath: string, data: Partial<Metadata>): Promise<Metadata>
```
- `read` returns `null` when no sidecar. `write` merges over existing (or a fresh default), stamps `updatedAt`, sets `schemaVersion:1`, creates `.meta/` lazily, returns the written object.

- [ ] **Step 1: Write failing tests** (use a temp dir via `os.tmpdir()` + `fs.mkdtemp`)

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { promises as fs } from 'fs'; import os from 'os'; import path from 'path'
import { readMetadata, writeMetadata } from './metadata-store'
import { metaPath } from '../shared/paths'

let dir: string, model: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'meta-')); model = path.join(dir, 'x.stl'); await fs.writeFile(model, 'x') })

describe('metadata-store', () => {
  it('returns null when missing', async () => expect(await readMetadata(model)).toBeNull())
  it('writes then reads, merging', async () => {
    await writeMetadata(model, { tags: ['a'] })
    const m = await writeMetadata(model, { notes: 'hi' })
    expect(m.tags).toEqual(['a']); expect(m.notes).toBe('hi'); expect(m.schemaVersion).toBe(1)
    expect(await fs.readFile(metaPath(model), 'utf8')).toContain('"notes": "hi"')
    expect((await readMetadata(model))!.notes).toBe('hi')
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement**

```ts
import { promises as fs } from 'fs'; import path from 'path'
import type { Metadata } from '../shared/types'; import { metaPath } from '../shared/paths'

const DEFAULT: Metadata = { schemaVersion: 1, tags: [], notes: '', updatedAt: '' }

export async function readMetadata(modelPath: string): Promise<Metadata | null> {
  try { return JSON.parse(await fs.readFile(metaPath(modelPath), 'utf8')) as Metadata }
  catch (e: any) { if (e.code === 'ENOENT') return null; throw e }
}
export async function writeMetadata(modelPath: string, data: Partial<Metadata>): Promise<Metadata> {
  const cur = (await readMetadata(modelPath)) ?? DEFAULT
  const next: Metadata = { ...cur, ...data, schemaVersion: 1, updatedAt: new Date().toISOString() }
  const p = metaPath(modelPath)
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, JSON.stringify(next, null, 2))
  return next
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `git commit -am "feat: metadata sidecar read/write with merge"`

### Task 1.5: `thumbnail-cache.ts`

**Files:** Create `src/main/thumbnail-cache.ts`, `src/main/thumbnail-cache.test.ts`

**Interfaces — Produces:**
```ts
export async function readThumbnail(modelPath: string): Promise<Buffer | null> // null if missing OR stale (source mtime newer)
export async function writeThumbnail(modelPath: string, png: Buffer): Promise<void>
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { promises as fs } from 'fs'; import os from 'os'; import path from 'path'
import { readThumbnail, writeThumbnail } from './thumbnail-cache'

let dir: string, model: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'thumb-')); model = path.join(dir, 'x.stl'); await fs.writeFile(model, 'model') })

describe('thumbnail-cache', () => {
  it('null when missing', async () => expect(await readThumbnail(model)).toBeNull())
  it('write then read returns bytes', async () => {
    await writeThumbnail(model, Buffer.from('PNGDATA'))
    expect((await readThumbnail(model))!.toString()).toBe('PNGDATA')
  })
  it('null when source is newer than thumbnail (stale)', async () => {
    await writeThumbnail(model, Buffer.from('PNGDATA'))
    const future = new Date(Date.now() + 10_000)
    await fs.utimes(model, future, future)
    expect(await readThumbnail(model)).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement**

```ts
import { promises as fs } from 'fs'; import path from 'path'
import { thumbPath } from '../shared/paths'

export async function readThumbnail(modelPath: string): Promise<Buffer | null> {
  const tp = thumbPath(modelPath)
  try {
    const [ts, ss] = await Promise.all([fs.stat(tp), fs.stat(modelPath)])
    if (ss.mtimeMs > ts.mtimeMs) return null // stale
    return await fs.readFile(tp)
  } catch (e: any) { if (e.code === 'ENOENT') return null; throw e }
}
export async function writeThumbnail(modelPath: string, png: Buffer): Promise<void> {
  const tp = thumbPath(modelPath)
  await fs.mkdir(path.dirname(tp), { recursive: true })
  await fs.writeFile(tp, png)
}
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `git commit -am "feat: mtime-invalidated thumbnail cache"`

### Task 1.6: `linked-image-store.ts`

**Files:** Create `src/main/linked-image-store.ts`, `src/main/linked-image-store.test.ts`

**Interfaces — Produces:**
```ts
export async function writeLinkedImage(modelPath: string, bytes: Buffer, ext: string): Promise<string> // returns stored filename, updates sidecar linkedImage, removes any previous
export async function readLinkedImage(modelPath: string): Promise<{ bytes: Buffer; name: string } | null> // uses sidecar linkedImage
export async function removeLinkedImage(modelPath: string): Promise<void> // deletes file + clears sidecar field
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { promises as fs } from 'fs'; import os from 'os'; import path from 'path'
import { writeLinkedImage, readLinkedImage, removeLinkedImage } from './linked-image-store'
import { readMetadata } from './metadata-store'

let dir: string, model: string
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'link-')); model = path.join(dir, 'x.stl'); await fs.writeFile(model, 'm') })

describe('linked-image-store', () => {
  it('writes image, sets sidecar, reads back', async () => {
    const name = await writeLinkedImage(model, Buffer.from('IMG1'), 'png')
    expect(name).toBe('x.stl.png')
    expect((await readMetadata(model))!.linkedImage).toBe('x.stl.png')
    const r = await readLinkedImage(model); expect(r!.bytes.toString()).toBe('IMG1'); expect(r!.name).toBe('x.stl.png')
  })
  it('replace deletes previous ext', async () => {
    await writeLinkedImage(model, Buffer.from('A'), 'png')
    await writeLinkedImage(model, Buffer.from('B'), 'jpg')
    expect((await readMetadata(model))!.linkedImage).toBe('x.stl.jpg')
    await expect(fs.access(path.join(dir, '.linked', 'x.stl.png'))).rejects.toBeTruthy()
  })
  it('detach clears field and deletes file', async () => {
    await writeLinkedImage(model, Buffer.from('A'), 'png')
    await removeLinkedImage(model)
    expect(await readLinkedImage(model)).toBeNull()
    expect((await readMetadata(model))!.linkedImage).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**
- [ ] **Step 3: Implement** (depends on Task 1.4 + 1.2)

```ts
import { promises as fs } from 'fs'; import path from 'path'
import { linkedPath } from '../shared/paths'
import { readMetadata, writeMetadata } from './metadata-store'

export async function writeLinkedImage(modelPath: string, bytes: Buffer, ext: string): Promise<string> {
  const meta = await readMetadata(modelPath)
  if (meta?.linkedImage) { await fs.rm(path.join(path.dirname(modelPath), '.linked', meta.linkedImage), { force: true }) }
  const p = linkedPath(modelPath, ext)
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, bytes)
  const name = path.basename(p)
  await writeMetadata(modelPath, { linkedImage: name })
  return name
}
export async function readLinkedImage(modelPath: string) {
  const meta = await readMetadata(modelPath)
  if (!meta?.linkedImage) return null
  const p = path.join(path.dirname(modelPath), '.linked', meta.linkedImage)
  try { return { bytes: await fs.readFile(p), name: meta.linkedImage } }
  catch (e: any) { if (e.code === 'ENOENT') return null; throw e }
}
export async function removeLinkedImage(modelPath: string): Promise<void> {
  const meta = await readMetadata(modelPath)
  if (meta?.linkedImage) await fs.rm(path.join(path.dirname(modelPath), '.linked', meta.linkedImage), { force: true })
  await writeMetadata(modelPath, { linkedImage: undefined })
}
```
> `writeMetadata` merge must drop `linkedImage` when set to `undefined`. Adjust merge in 1.4 to delete keys whose value is `undefined` (add `if (next.linkedImage === undefined) delete next.linkedImage`). Add a test for that in 1.4.

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `git commit -am "feat: linked reference image store (attach/replace/detach)"`

### Task 1.7: `app-state.ts` (last folder) + IPC + preload

**Files:** Create `src/main/app-state.ts`, `src/main/ipc.ts`; modify `src/main/index.ts`, `src/preload/index.ts`; create `src/preload/index.test-d.ts` (type check only) and `src/renderer/ipc/api.ts`

**Interfaces — Produces (preload `window.api`):**
```ts
interface Api {
  openFolderDialog(): Promise<string | null>
  scanFolder(dir: string): Promise<ScanResult>
  readFileBytes(p: string): Promise<ArrayBuffer>
  readMetadata(model: string): Promise<Metadata | null>
  writeMetadata(model: string, data: Partial<Metadata>): Promise<Metadata>
  readThumbnail(model: string): Promise<ArrayBuffer | null>
  writeThumbnail(model: string, png: ArrayBuffer): Promise<void>
  readLinkedImage(model: string): Promise<{ bytes: ArrayBuffer; name: string } | null>
  writeLinkedImage(model: string, bytes: ArrayBuffer, ext: string): Promise<string>
  removeLinkedImage(model: string): Promise<void>
  getLastFolder(): Promise<string | null>
  setLastFolder(dir: string): Promise<void>
  onOpenFile(cb: (path: string) => void): void
}
```

- [ ] **Step 1:** Implement `app-state.ts` — read/write `{ lastFolder }` JSON in `app.getPath('userData')/state.json`. (Small; test with a temp override of the path, or skip unit test and cover via manual run — prefer a unit test injecting a base dir: `export function makeAppState(baseDir)`.)

- [ ] **Step 2:** Implement `ipc.ts` — `registerIpc()` wiring each `ipcMain.handle('<name>', ...)` to the store functions above. Convert `Buffer`↔`ArrayBuffer` at the boundary (`buf.buffer.slice(...)`). `openFolderDialog` uses `dialog.showOpenDialog({ properties: ['openDirectory'] })`.

- [ ] **Step 3:** `preload/index.ts` — expose `window.api` mapping each method to `ipcRenderer.invoke('<name>', ...)`; `onOpenFile` subscribes to `ipcRenderer.on('open-file', ...)`.

- [ ] **Step 4:** `main/index.ts` — call `registerIpc()`; handle macOS `app.on('open-file')` and Windows `process.argv` → forward path to renderer via `win.webContents.send('open-file', path)` once ready (queue if not ready).

- [ ] **Step 5:** `renderer/ipc/api.ts` — `export const api = window.api as Api` with the `Api` type imported from a shared d.ts.

- [ ] **Step 6: Manual smoke** — `npm run dev`, open devtools, run `await window.api.scanFolder('<some folder>')`, confirm shape.

- [ ] **Step 7: Commit** `git commit -am "feat: IPC surface + preload bridge + last-folder state"`

---

## Phase 2 — Renderer state & folder browsing

### Task 2.1: Zustand store

**Files:** Create `src/renderer/state/store.ts`, `src/renderer/state/store.dom.test.ts`

**Interfaces — Produces:**
```ts
type Mode = 'grid' | 'viewer'
interface UiState {
  cwd: string | null; scan: ScanResult | null
  selectedIndex: number | null           // index into scan.files
  mode: Mode; showFilmstrip: boolean; showInfo: boolean
  search: string; activeTags: string[]; includeSubfolders: boolean
  material: string; lighting: string
  openFolder(dir: string): Promise<void>  // scans, resets selection
  select(index: number): void             // sets selection + mode='viewer'
  next(): void; prev(): void              // clamp within filtered files
  setMode(m: Mode): void; toggleFilmstrip(): void; toggleInfo(): void
  setSearch(s: string): void; toggleTag(t: string): void; setIncludeSubfolders(b: boolean): void
}
```

- [ ] **Step 1: Write failing test** (jsdom) covering `select` sets mode='viewer', `next/prev` clamp at bounds, `toggleTag` adds/removes. Mock `api.scanFolder`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** the store with Zustand `create`.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `git commit -am "feat: renderer ui store"`

### Task 2.2: `filter.ts` (search + tag filter) — PURE

**Files:** Create `src/renderer/lib/filter.ts`, `src/renderer/lib/filter.test.ts`

**Interfaces — Produces:**
```ts
export interface Indexed { file: FileEntry; tags: string[] }
export function filterModels(items: Indexed[], q: string, activeTags: string[]): FileEntry[]
// q: case-insensitive substring on file.name; activeTags: file must contain ALL active tags
export function allTags(items: Indexed[]): string[] // unique, sorted
```

- [ ] **Step 1: Write failing tests** (empty query returns all; substring match; AND semantics for multiple tags; `allTags` dedupes/sorts).
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `git commit -am "feat: pure search + tag filter"`

### Task 2.3: Breadcrumbs, FolderTile, GridView, EmptyState (browsing, no thumbnails yet)

**Files:** Create `src/renderer/components/{EmptyState,Breadcrumbs,FolderTile,ModelTile,GridView}.tsx`; modify `App.tsx`; add `src/renderer/App.dom.test.tsx`

**Interfaces:**
- Consumes: store (2.1), filter (2.2), `api` (1.7).
- Produces: clicking "Open folder" → dialog → store.openFolder; grid shows folder tiles + model tiles (name + placeholder); clicking a folder tile calls `openFolder(child)`; breadcrumb segments navigate up; clicking a model tile → `store.select(index)`.

- [ ] **Step 1: Component test** (jsdom + RTL): render `<App/>` with mocked `api.scanFolder` returning `tree`; assert folder tile "sub" and model tile "a.stl" render; click "a.stl" → store mode becomes 'viewer'.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** components + wire into `App.tsx` layout (top bar, breadcrumb, grid). Use CSS grid; virtualization added in 3.3.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Manual** `npm run dev` → Open a real folder of STLs → see tiles + breadcrumbs.
- [ ] **Step 6: Commit** `git commit -am "feat: folder browsing UI (grid, folders, breadcrumbs, empty state)"`

---

## Phase 3 — STL parsing & thumbnails

### Task 3.1: `stl-parser.ts` — PURE

**Files:** Create `src/renderer/lib/stl-parser.ts`, `src/renderer/lib/stl-parser.test.ts`

**Interfaces — Produces:**
```ts
export interface ParsedSTL { positions: Float32Array; triCount: number; bbox: { min:[number,number,number]; max:[number,number,number] } }
export function parseSTL(buf: ArrayBuffer): ParsedSTL // auto-detects binary vs ASCII
```

- [ ] **Step 1: Write failing tests** — load both fixtures via `fs.readFileSync(...).buffer`, assert `triCount === 12`, `positions.length === 12*9`, and bbox min≈[0,0,0] max≈[1,1,1].

```ts
import { readFileSync } from 'fs'; import path from 'path'
import { describe, it, expect } from 'vitest'; import { parseSTL } from './stl-parser'
const load = (f: string) => { const b = readFileSync(path.resolve(__dirname, '../../../tests/fixtures', f)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }
describe('parseSTL', () => {
  for (const f of ['cube-bin.stl', 'cube-ascii.stl']) it(`parses ${f}`, () => {
    const r = parseSTL(load(f)); expect(r.triCount).toBe(12); expect(r.positions.length).toBe(108)
    expect(r.bbox.max).toEqual([1, 1, 1]); expect(r.bbox.min).toEqual([0, 0, 0])
  })
})
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** binary/ASCII detection + parse. (Binary detection: if header not `solid` OR `84 + 50*count === byteLength`. Compute bbox during parse.) Do **not** depend on three.js here — keep pure so it runs in Node tests and the worker.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Commit** `git commit -am "feat: pure STL parser (binary + ascii) with bbox"`

### Task 3.2: STL worker + `ModelStats`

**Files:** Create `src/renderer/workers/stl.worker.ts`, `src/renderer/lib/load-model.ts` (posts to worker, returns `{ positions, stats }`), test `src/renderer/lib/load-model.dom.test.ts` (mock Worker) — or cover worker glue manually and unit-test a `computeStats(parsed)` pure helper.

**Interfaces — Produces:**
```ts
export function computeStats(p: ParsedSTL): ModelStats // vertCount = triCount*3, bbox dims = max-min
export function loadModel(bytes: ArrayBuffer): Promise<{ positions: Float32Array; stats: ModelStats }>
```

- [ ] **Step 1: Failing test** for `computeStats` (pure): dims from bbox, vertCount = triCount*3.
- [ ] **Step 2: FAIL → implement → PASS.**
- [ ] **Step 3:** Implement `stl.worker.ts` (calls `parseSTL`, transfers `positions.buffer`) and `loadModel` glue.
- [ ] **Step 4: Commit** `git commit -am "feat: off-thread STL loading + model stats"`

### Task 3.3: `thumbnailer.ts` + lazy thumbnails in grid (virtualized)

**Files:** Create `src/renderer/viewer/thumbnailer.ts`; modify `ModelTile.tsx`, `GridView.tsx`

**Interfaces — Produces:** `export async function renderThumbnail(positions: Float32Array, size = 256): Promise<Blob>` — offscreen three.js render (neutral studio env, matte material, auto-fit) → PNG Blob.

- [ ] **Step 1:** Implement `thumbnailer` using an `OffscreenCanvas` (fallback to a detached `<canvas>`), a shared `WebGLRenderer`, `RoomEnvironment`. Build `BufferGeometry` from positions, `computeVertexNormals()`, fit camera, render, `canvas.convertToBlob()`.
- [ ] **Step 2:** `ModelTile` effect: when visible (IntersectionObserver), `api.readThumbnail(path)`; on null → `api.readFileBytes` → `loadModel` → `renderThumbnail` → `api.writeThumbnail(png)` → show. Bound concurrency with a small queue (max ~4).
- [ ] **Step 3:** Virtualize `GridView` (windowed rendering by scroll position; simple row-window math — no extra dep required).
- [ ] **Step 4: Manual verify** `npm run dev` on a real folder → thumbnails render and persist to `.thumb/` (re-open is instant).
- [ ] **Step 5: Component test** — `ModelTile` shows an `<img>` after `readThumbnail` resolves with bytes (mock URL.createObjectURL).
- [ ] **Step 6: Commit** `git commit -am "feat: lazy cached thumbnails + virtualized grid"`

---

## Phase 4 — 3D viewer

### Task 4.1: `materials.ts` + `lighting.ts` (preset factories)

**Files:** Create `src/renderer/viewer/materials.ts`, `src/renderer/viewer/lighting.ts`, tests `materials.test.ts`, `lighting.test.ts`

**Interfaces — Produces:**
```ts
export type MaterialPreset = 'matte'|'glossy'|'metal'|'clay'|'ceramic'|'wireframe'
export const MATERIAL_PRESETS: MaterialPreset[]
export function makeMaterial(preset: MaterialPreset, baseColor: string, matcaps: Record<'clay'|'ceramic', Texture>): Material
export type LightPreset = 'studio'|'soft'|'dramatic'|'top'
export const LIGHT_PRESETS: LightPreset[]
export function makeLights(preset: LightPreset, intensity: number): Light[]
```

- [ ] **Step 1: Tests** assert each preset yields the expected three.js material/light class (e.g. `makeMaterial('metal',...)` → `MeshStandardMaterial` with `metalness===1`; `'clay'` → `MeshMatcapMaterial`; `'wireframe'` → material with `wireframe===true`; `makeLights('studio',1)` returns 3 directional + ambient). Import three in a jsdom test (no WebGL needed to construct materials/lights).
- [ ] **Step 2: FAIL → implement → PASS.**
- [ ] **Step 3: Commit** `git commit -am "feat: material and lighting preset factories"`

### Task 4.2: `SceneManager.ts` + `cameraControls.ts`

**Files:** Create `src/renderer/viewer/SceneManager.ts`, `src/renderer/viewer/cameraControls.ts`

**Interfaces — Produces:**
```ts
class SceneManager {
  constructor(canvas: HTMLCanvasElement)
  setModel(positions: Float32Array): void   // rebuild geometry, computeVertexNormals, dispose old, fit camera
  setMaterial(preset, baseColor): void
  setLighting(preset, intensity): void
  setBackground(mode: 'light'|'dark'): void
  setGrid(on: boolean): void; setAutoRotate(on: boolean): void; resetCamera(): void
  resize(w: number, h: number): void; dispose(): void
}
export function fitCameraToObject(camera, object, controls): void
```

- [ ] **Step 1:** Implement (imperative three.js; OrbitControls with damping; RAF loop; `RoomEnvironment` via `PMREMGenerator`). Load matcap textures from committed assets.
- [ ] **Step 2: Manual** harness (temporary route/button) to sanity-check rendering a fixture. No unit test for GPU output.
- [ ] **Step 3: Commit** `git commit -am "feat: three.js SceneManager + camera fit/controls"`

### Task 4.3: `Viewer.tsx` + `ViewerToolbar.tsx` + Prev/Next + keyboard + Filmstrip

**Files:** Create `src/renderer/components/{Viewer,ViewerToolbar,Filmstrip}.tsx`; modify `App.tsx`

**Interfaces:**
- Consumes: store, SceneManager, `loadModel`, presets.
- Produces: Viewer mode layout — Filmstrip (left, collapsible) · canvas (center) · InfoPanel slot (right, Phase 5). Toolbar: material presets, lighting presets + intensity, reset/auto-rotate/grid/background toggles, Prev/Next. Keyboard: `←/→` prev/next, `Esc` → grid, `F` filmstrip, `I` info.

- [ ] **Step 1:** Implement `Viewer` — creates a `SceneManager` on mount, `loadModel(selectedFile)` → `setModel`, reacts to store material/lighting. On selection change, load new model + refit.
- [ ] **Step 2:** `ViewerToolbar` bound to store; `Filmstrip` reuses `ModelTile` (thumbnails) filtered like the grid.
- [ ] **Step 3:** Global key handler (in `App`) dispatching to store; guard when typing in inputs.
- [ ] **Step 4: Component test** — pressing `→` advances `selectedIndex`; `Esc` sets mode 'grid'; toggles flip pane flags. (Mock SceneManager.)
- [ ] **Step 5: Manual** `npm run dev` → open model, orbit, switch materials/lights, Prev/Next, keyboard.
- [ ] **Step 6: Commit** `git commit -am "feat: 3D viewer, toolbar, filmstrip, navigation + shortcuts"`

---

## Phase 5 — Metadata UI (info panel, tags, notes, search/filter)

### Task 5.1: `InfoPanel.tsx` + `TagEditor.tsx`

**Files:** Create `src/renderer/components/{InfoPanel,TagEditor}.tsx`; modify `Viewer.tsx`

**Interfaces:**
- Consumes: store (selected file + stats from loadModel), `api.readMetadata/writeMetadata`.
- Produces: right pane showing filename/path, size, tri/vert counts, bbox dims (mm), TagEditor (chips add/remove), Notes textarea. Edits debounce (~500ms) → `api.writeMetadata`; results refresh the in-memory tag index used by filters.

- [ ] **Step 1: Component test** — editing a tag calls `api.writeMetadata` (debounced; use fake timers); stats render from provided `ModelStats`.
- [ ] **Step 2: FAIL → implement → PASS.**
- [ ] **Step 3:** Load metadata on selection change; keep a store map `metaByPath` so filters see tags without re-reading.
- [ ] **Step 4: Commit** `git commit -am "feat: info panel with stats, tags, notes (debounced save)"`

### Task 5.2: `SearchBox.tsx` + `TagFilterBar.tsx` + "include subfolders"

**Files:** Create `src/renderer/components/{SearchBox,TagFilterBar}.tsx`; modify `TopBar.tsx`, `GridView.tsx`, store

**Interfaces:**
- Produces: search input → `store.setSearch`; tag chips (from `allTags`) toggle `activeTags`; "include subfolders" toggle. When on, scan recurses (a `scanTree(dir)` in main, or renderer-side recursive `scanFolder`) and filters span the tree.

- [ ] **Step 1:** Add `scanTree` to main + IPC (recurse, skipping HIDDEN_DIRS) with a unit test using `tests/fixtures/tree` (expects `a.stl` + `sub/b.stl`).
- [ ] **Step 2:** Wire filter UI; `GridView` renders `filterModels(indexed, search, activeTags)`.
- [ ] **Step 3: Component test** — typing narrows tiles; selecting a tag narrows to matching; subfolder toggle includes nested.
- [ ] **Step 4: Commit** `git commit -am "feat: search, tag filter, include-subfolders"`

---

## Phase 6 — Linked reference image UI

### Task 6.1: `ReferenceImage.tsx` (drag-drop + paste + detach)

**Files:** Create `src/renderer/components/ReferenceImage.tsx`; modify `InfoPanel.tsx`

**Interfaces:**
- Consumes: `api.readLinkedImage/writeLinkedImage/removeLinkedImage`, selected file.
- Produces: empty drop zone ("Drag an image here, or paste ⌘/Ctrl+V"); on drop of an image file → read as ArrayBuffer + ext → `writeLinkedImage`; on `paste` with image clipboard data → `writeLinkedImage(..., 'png')`; attached state shows preview (object URL) + Detach → `removeLinkedImage`; click preview → enlarged overlay.

- [ ] **Step 1: Component test** — simulate a `drop` with a `File` (image/png) → `writeLinkedImage` called with bytes+`'png'`; render preview when `readLinkedImage` returns bytes; Detach → `removeLinkedImage`. Simulate `paste` event with an image item.
- [ ] **Step 2: FAIL → implement → PASS.**
- [ ] **Step 3: Manual** `npm run dev` → drop a PNG onto the pane; paste a screenshot; verify `.linked/` file + sidecar `linkedImage`; detach removes both.
- [ ] **Step 4: Commit** `git commit -am "feat: linked reference image (drag-drop, paste, detach)"`

---

## Phase 7 — Single-file open, packaging, polish

### Task 7.1: Single-file open (default STL app) end-to-end

**Files:** modify `src/main/index.ts`, `src/renderer/App.tsx`, store

**Interfaces:**
- Produces: on `onOpenFile(path)` → `store.openFolder(dirname(path))` then `select(indexOf file)` (mode 'viewer'). Handle both cold start (queue path until renderer ready) and running app.

- [ ] **Step 1:** Renderer subscribes `api.onOpenFile` once; resolves index by matching path in scan; selects.
- [ ] **Step 2: Manual (macOS)** `open -a <dev build path> tests/fixtures/tree/a.stl` — or verify via packaged build in 7.2.
- [ ] **Step 3: Commit** `git commit -am "feat: open a single .stl into the viewer with sibling nav"`

### Task 7.2: electron-builder packaging + `.stl` association + last-folder reopen

**Files:** Create `electron-builder.yml`; add build assets (icons); modify `package.json` scripts, `App.tsx` (offer reopen last folder in EmptyState)

- [ ] **Step 1:** `electron-builder.yml` with `appId`, `mac.target: dmg`, `win.target: nsis`, and `fileAssociations: [{ ext: 'stl', name: 'STL Model', role: 'Viewer' }]`. Add `"dist": "electron-vite build && electron-builder"`.
- [ ] **Step 2:** EmptyState: if `getLastFolder()` non-null, show "Reopen <name>" button → `openFolder`.
- [ ] **Step 3: Build** `npm run dist` → produces a macOS `.dmg` (and `.exe`/nsis on Windows). Install locally; set as default STL app; double-click a `.stl` → opens in viewer.
- [ ] **Step 4: Commit** `git commit -am "build: electron-builder packaging + stl file association + reopen last folder"`

### Task 7.3: App styling pass (modern, dark/light) + Material Symbols icons

**Files:** Create `src/renderer/styles.css` (or CSS modules), commit `src/renderer/assets/icons/*`; modify components

- [ ] **Step 1:** Download the specific Material Symbols SVGs used (folder, search, tag, image, arrows, sun/moon, grid, rotate, close) into `assets/icons/` and reference locally.
- [ ] **Step 2:** Apply a clean modern theme (system font stack, subtle borders, dark default + light option, the panel layout from `wiki/02`). Ensure responsive panes.
- [ ] **Step 3: Manual** review; adjust.
- [ ] **Step 4: Commit** `git commit -am "style: modern themed UI with bundled Material Symbols icons"`

---

## Phase 8 — End-to-end test & final verification

### Task 8.1: Playwright-Electron smoke test

**Files:** Create `playwright.config.ts`, `tests/e2e/smoke.spec.ts`

**Interfaces:** launches the built app via `_electron.launch`, drives the golden path.

- [ ] **Step 1: Write the E2E**: launch app → programmatically point it at `tests/fixtures/tree` (via a test hook: accept a `--folder` argv in main that calls openFolder) → assert `a.stl` tile visible → click → viewer canvas present → press `ArrowRight` → add a tag → assert `.meta/a.stl.json` exists on disk with the tag.
- [ ] **Step 2: Run** `npm run build && npx playwright test` → PASS.
- [ ] **Step 3: Commit** `git commit -am "test: playwright-electron smoke covering the golden path"`

### Task 8.2: Full verification sweep

- [ ] **Step 1:** `npm run test` (all unit/component green), `npx playwright test` (E2E green), `npm run dev` manual pass of every feature against a real STL folder.
- [ ] **Step 2:** Update `wiki/_INDEX.md` status line to "v1 implemented". Commit.

---

## Self-Review notes (author)

- **Spec coverage:** open-folder + recurse/breadcrumbs (2.3, 5.2) ✓; STL-only parse (3.1) ✓; thumbnails `.thumb` mtime cache (1.5, 3.3) ✓; metadata `.meta` tags/notes (1.4, 5.1) ✓; linked image `.linked` drag/paste/detach (1.6, 6.1) ✓; 6 materials / 4 lights (4.1) ✓; camera controls (4.2) ✓; Prev/Next + shortcuts (4.3) ✓; search + tag filter + subfolders (2.2, 5.2) ✓; single-file open + association (7.1, 7.2) ✓; mm units (5.1) ✓; offline icons/env (7.3, 3.3/4.2) ✓; packaging (7.2) ✓; security posture (0.1) ✓; last-folder reopen (1.7, 7.2) ✓; testing pyramid (throughout, 8.1) ✓.
- **Type consistency:** `ParsedSTL`, `ModelStats`, `Metadata`, `ScanResult`, `Api`, preset unions are defined once and reused. `writeMetadata` `undefined`-key deletion is called out in 1.4/1.6.
- **Known manual-verification points** (GPU/render/packaging) are explicitly flagged where unit tests can't assert output.
