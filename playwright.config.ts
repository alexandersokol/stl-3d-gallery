import { defineConfig } from '@playwright/test'

// Electron + WebGL smoke test (Task 8.1). This is the first real launch of
// the assembled app -- no dev server involved (electron.launch() spawns the
// built app directly from tests/e2e/smoke.spec.ts), and no browser project
// list, since Playwright's Electron support runs through _electron rather
// than a configured browser. The app + WebGL context needs a moment to spin
// up on a cold launch, so timeouts here are generous relative to the unit
// suite.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
})
