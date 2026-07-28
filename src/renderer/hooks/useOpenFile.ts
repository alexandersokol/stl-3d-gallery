import { useEffect, useRef } from 'react'
import { api } from '../ipc/api'
import { useUiStore } from '../state/store'
import { dirname } from '../lib/paths'

// Handles the "open a single .stl from the OS" flow (Task 7.1): the main
// process forwards an opened file's path via `api.onOpenFile` -- both on
// cold start (queued until the renderer subscribes) and while the app is
// already running (macOS re-open, or a second Windows launch). We open that
// file's parent folder, then select the file within it so the user lands
// directly in the viewer with Prev/Next able to walk its siblings.
//
// Also handles the "startup folder" hook (Task 8.1): if the app was
// launched with `--folder <path>`, open that folder in grid mode on mount.
// This exists purely so the Playwright E2E harness can point a launched
// build at a deterministic fixture folder cross-platform, without relying
// on OS file-association plumbing. In normal use argv never carries
// `--folder`, so `getStartupFolder` resolves to null and this is a no-op.
export function useOpenFile(): void {
  // `api.onOpenFile` has no unsubscribe (returns void), so we must ensure we
  // only ever register one callback for the lifetime of the app. A ref
  // (rather than relying on the empty dep array alone) survives React's
  // dev-mode double-invocation of effects and makes the "subscribe exactly
  // once" intent explicit. The same guard covers the startup-folder check
  // below so it also only ever runs once per app lifetime.
  const subscribed = useRef(false)

  useEffect(() => {
    if (subscribed.current) return
    subscribed.current = true

    api.onOpenFile((filePath) => {
      void handleOpenFile(filePath)
    })

    void handleStartupFolder()
  }, [])
}

async function handleStartupFolder(): Promise<void> {
  const dir = await api.getStartupFolder()
  if (dir) {
    // Grid mode -- do NOT auto-select a model, unlike handleOpenFile above.
    await useUiStore.getState().openFolder(dir)
  }
}

async function handleOpenFile(filePath: string): Promise<void> {
  const dir = dirname(filePath)
  await useUiStore.getState().openFolder(dir)

  const { scan } = useUiStore.getState()
  if (!scan) return

  let index = scan.files.findIndex((f) => f.path === filePath)
  if (index === -1) {
    // Fall back to a case-insensitive match in case the OS handed us a path
    // whose casing differs from what the scan reports (e.g. macOS/Windows
    // case-insensitive filesystems).
    const lowerFilePath = filePath.toLowerCase()
    index = scan.files.findIndex((f) => f.path.toLowerCase() === lowerFilePath)
  }

  if (index !== -1) {
    useUiStore.getState().select(index)
  }
  // If still not found, leave the folder open in grid mode -- nothing more
  // to do.
}
