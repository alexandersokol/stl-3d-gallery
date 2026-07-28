import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'

// First real launch of the assembled app (Task 8.1): drives the built
// Electron binary end-to-end through the golden path (grid -> viewer ->
// navigate -> tag -> persisted sidecar), exercising runtime + WebGL
// rendering that mocked unit/jsdom tests can't touch.
//
// Requires `npm run build` (electron-vite build) to have already produced
// `out/main/index.js` -- the `e2e` script in package.json runs
// `electron-vite build && playwright test` so this is satisfied when driven
// that way.

const REPO_ROOT = path.resolve(__dirname, '../..')
const MAIN_ENTRY = path.join(REPO_ROOT, 'out/main/index.js')
const FIXTURES_DIR = path.join(REPO_ROOT, 'tests/fixtures')

const SCRATCH_DIR =
  '/private/tmp/claude-501/-Users-alexander-Projects-Python-stl-gallery/de4be7d3-5862-4ed0-916e-4a8d29f65288/scratchpad'
const GRID_PNG = path.join(SCRATCH_DIR, 'e2e-grid.png')
const VIEWER_PNG = path.join(SCRATCH_DIR, 'e2e-viewer.png')

let tempDir: string
let app: ElectronApplication
let win: Page

test.beforeAll(async () => {
  await fs.access(MAIN_ENTRY).catch(() => {
    throw new Error(
      `Built main entry not found at ${MAIN_ENTRY} -- run "npm run build" (electron-vite build) before the E2E suite.`,
    )
  })

  // Two sibling STL fixtures in a fresh temp folder, so the grid has two
  // tiles and Prev/Next navigation has somewhere to go.
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stl-gallery-e2e-'))
  await fs.copyFile(path.join(FIXTURES_DIR, 'cube-bin.stl'), path.join(tempDir, 'alpha.stl'))
  await fs.copyFile(path.join(FIXTURES_DIR, 'cube-ascii.stl'), path.join(tempDir, 'beta.stl'))

  app = await electron.launch({
    args: [
      MAIN_ENTRY,
      '--folder',
      tempDir,
      // GPU-friendly flags for WebGL in a launch environment without a
      // "real" desktop compositor (CI runners, headless-ish sandboxes).
      // SwiftShader gives us a software GL context that still produces a
      // real WebGL-rendered canvas rather than an opaque/failed one.
      '--use-gl=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox',
    ],
  })
  win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app?.close()
  if (tempDir) await fs.rm(tempDir, { recursive: true, force: true })
})

test('golden path: grid -> viewer -> navigate -> tag -> persisted sidecar', async () => {
  // 1. Grid shows both models (opened via the --folder startup hook, Task
  // 8.1's Part 1, in grid mode -- nothing pre-selected).
  await expect(win.getByText('alpha.stl')).toBeVisible()
  await expect(win.getByText('beta.stl')).toBeVisible()

  await fs.mkdir(SCRATCH_DIR, { recursive: true })
  await win.screenshot({ path: GRID_PNG })

  // 2. Click a tile -> viewer mode, a <canvas> (the three.js viewer) is
  // present. We don't assert pixel content here -- WebGL availability
  // varies by launch environment -- just that the app actually switched
  // into the viewer and mounted the engine's canvas.
  await win.getByText('alpha.stl').click()
  const canvas = win.locator('canvas.viewer-canvas')
  await expect(canvas).toBeVisible()

  // Let the model finish loading (info panel reflects the selected file)
  // before driving keyboard/tag interactions against it.
  await expect(win.locator('.info-panel-filename')).toHaveText('alpha.stl')

  await win.screenshot({ path: VIEWER_PNG })

  // 3. ArrowRight advances the selection to the sibling model.
  await win.keyboard.press('ArrowRight')
  await expect(win.locator('.info-panel-filename')).toHaveText('beta.stl')

  // 4. Add a tag via the info panel's tag input, Enter to commit it.
  const tagInput = win.getByPlaceholder('Add tag')
  await tagInput.fill('smoke-tested')
  await tagInput.press('Enter')
  await expect(win.getByText('smoke-tested')).toBeVisible()

  // Give the debounced (500ms) metadata save time to land on disk.
  await win.waitForTimeout(700)

  // 5. Assert the .meta sidecar was actually written, with the new tag.
  const metaFile = path.join(tempDir, '.meta', 'beta.stl.json')
  const raw = await fs.readFile(metaFile, 'utf8')
  const meta = JSON.parse(raw) as { tags: string[] }
  expect(meta.tags).toContain('smoke-tested')
})
