import { defineConfig } from 'vitest/config'

// Note: vitest 4's `environmentMatchGlobs` option was removed (not just
// deprecated) — it no longer exists on the config type and has no effect.
// The replacement mechanism used here: default environment is 'node' for
// speed/purity in main-process & pure-logic tests. Any test file that needs
// a DOM (e.g. React component tests) must opt in per-file via a docblock
// at the top of the file:
//
//   // @vitest-environment jsdom
//
// Convention: name such files `*.dom.test.{ts,tsx}` so the jsdom
// requirement is visible from the filename too, but the docblock is what
// vitest actually reads to pick the environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
    // No test files exist yet this early in the build-out (Phase 0); don't
    // fail the run just because of that. Later tasks add real test files.
    passWithNoTests: true,
  },
})
