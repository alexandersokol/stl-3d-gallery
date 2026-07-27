import { afterEach } from 'vitest'

// This file is loaded for EVERY test file, regardless of environment
// ('node' or 'jsdom' — see vitest.config.mts for how that's chosen
// per-file). Most tests here run in the 'node' environment and have no
// `document`, so anything DOM-related must be strictly opt-in behind a
// guard — importing '@testing-library/react' (which touches `document`
// at module-eval time) in a node-environment test would throw.
//
// In jsdom-environment tests, this registers jest-dom's matchers
// (toBeInTheDocument, etc.) and RTL's automatic cleanup after each test,
// so individual *.dom.test.tsx files don't need to repeat that
// boilerplate themselves.
if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
  const { cleanup } = await import('@testing-library/react')
  afterEach(() => {
    cleanup()
  })
}
