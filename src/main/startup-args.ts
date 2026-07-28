// Pure helper for extracting a `--folder <path>` (or `--folder=<path>`) CLI
// argument from argv. Used by the E2E harness (Task 8.1) to point the built
// app at a deterministic fixture folder on launch, cross-platform, without
// relying on OS file-association plumbing (which is macOS/Windows-specific
// and not scriptable from Playwright's electron.launch). Harmless in normal
// use: a real user's argv never contains `--folder`, so this returns null
// and is a no-op.
export function parseStartupFolder(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--folder') {
      const next = argv[i + 1]
      return next !== undefined ? next : null
    }
    if (arg.startsWith('--folder=')) {
      return arg.slice('--folder='.length)
    }
  }
  return null
}
