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

// The .stl a Windows/Linux file-association launch passes on the command line
// (macOS uses the 'open-file' event instead). Used for both the first launch
// (process.argv) and a 'second-instance' event's argv, where Electron may add
// Chromium switches around it -- so take the last non-switch .stl argument.
export function findStlArg(argv: string[]): string | null {
  for (let i = argv.length - 1; i >= 1; i--) {
    const arg = argv[i]
    if (!arg.startsWith('-') && arg.toLowerCase().endsWith('.stl')) return arg
  }
  return null
}
