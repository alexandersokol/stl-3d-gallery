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

  // jsdom ships no IntersectionObserver at all. Components that use one
  // (ModelTile's lazy thumbnail loading) would throw a ReferenceError on
  // mount in any jsdom test that doesn't specifically care about
  // intersection behavior (e.g. App.dom.test.tsx, which renders a full
  // grid of tiles incidentally). Install a harmless no-op stub here as the
  // default so those tests don't need to know about it; tests that DO care
  // (ModelTile.dom.test.tsx) install their own richer capturing mock on
  // `globalThis.IntersectionObserver` in beforeEach, which simply
  // overrides this default for the duration of that test file.
  if (typeof globalThis.IntersectionObserver === 'undefined') {
    class NoopIntersectionObserver implements IntersectionObserver {
      readonly root: Element | Document | null = null
      readonly rootMargin: string = ''
      readonly scrollMargin: string = ''
      readonly thresholds: ReadonlyArray<number> = []
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): IntersectionObserverEntry[] {
        return []
      }
    }
    globalThis.IntersectionObserver = NoopIntersectionObserver as unknown as typeof IntersectionObserver
  }
}
