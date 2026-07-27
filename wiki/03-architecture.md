# 03 — Architecture

[← Back to index](_INDEX.md)

## Process model

Standard secure Electron split:

- **Main process** — owns all privileged/native work: app lifecycle, the browser window, native dialogs, file-association handling, and every filesystem operation.
- **Renderer process** — a React app. Owns all UI, the three.js viewer, and Web Workers. Has **no direct Node/filesystem access**.
- **Preload script** — the only bridge. Uses `contextBridge` to expose a small, explicit, typed API surface to the renderer.

### Security posture
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` where compatible with the preload bridge
- The renderer touches the filesystem **only** through the preload API — never via `require`/`fs`.

## Module breakdown

Each module has one clear purpose and a well-defined interface, so it can be understood and tested in isolation.

### Main process
| Module | Responsibility |
|--------|----------------|
| `main/index.ts` | App lifecycle, window creation, `open-file` / argv handling |
| `main/ipc.ts` | Registers IPC handlers; the boundary between renderer requests and main modules |
| `main/preload.ts` | `contextBridge` API definition (typed) |
| `main/fs-scanner.ts` | Scan a directory → list of STL files (with stat) + subfolders |
| `main/metadata-store.ts` | Read/write `.meta/<name>.stl.json` sidecars |
| `main/thumbnail-cache.ts` | Read/write `.thumb/<name>.stl.png`; validity keyed by source mtime |
| `main/linked-image-store.ts` | Read/write/delete `.linked/<name>.<ext>` reference images |

### Renderer — UI
`TopBar`, `Breadcrumbs`, `GridView` (virtualized), `Filmstrip`, `Viewer`, `InfoPanel`, `SearchBox`, `TagFilterBar`.

### Renderer — viewer & workers
| Module | Responsibility |
|--------|----------------|
| `viewer/SceneManager.ts` | three.js scene/renderer/camera lifecycle |
| `viewer/materials.ts` | Material preset factory (see [Viewer](05-viewer.md)) |
| `viewer/lighting.ts` | Lighting preset factory |
| `viewer/cameraControls.ts` | OrbitControls, auto-fit, reset, auto-rotate |
| `workers/stl-worker.ts` | Parse STL bytes → geometry off the main thread |
| `thumbnails/thumbnailer.ts` | Offscreen-render a geometry → PNG bytes |

### Renderer — state
Global UI state in a **Zustand** store: current folder & file list, selection, mode, pane visibility, active filters/search, and active viewer presets.

## IPC surface (preload API)

Illustrative shape (final types live in code):

```ts
window.api = {
  openFolderDialog(): Promise<string | null>,
  scanFolder(path): Promise<{ folders: FolderEntry[]; files: FileEntry[] }>,
  readFileBytes(path): Promise<ArrayBuffer>,        // for parsing / thumbnailing
  readMetadata(modelPath): Promise<Metadata | null>,
  writeMetadata(modelPath, data): Promise<void>,
  readThumbnail(modelPath): Promise<ArrayBuffer | null>,
  writeThumbnail(modelPath, pngBytes): Promise<void>,
  readLinkedImage(modelPath): Promise<{ bytes: ArrayBuffer; name: string } | null>,
  writeLinkedImage(modelPath, bytes, ext): Promise<string>,   // returns stored filename
  removeLinkedImage(modelPath): Promise<void>,
  onOpenFile(cb): void,                              // single-file launch/association
}
```

## Data flow

1. **Open folder** → `openFolderDialog` → `scanFolder` → store holds folders + files → **grid renders immediately** with placeholders.
2. **Thumbnails** → for each visible tile: `readThumbnail`; on miss → `readFileBytes` → `stl-worker` parses → `thumbnailer` renders offscreen → `writeThumbnail` → display. (Lazy, virtualized — only visible tiles work.)
3. **Open model** → `readFileBytes` → `stl-worker` parses geometry → `SceneManager` displays, camera auto-fits, presets applied.
4. **Info panel** → geometry stats computed in-renderer; `readMetadata` supplies tags/notes.
5. **Edit tags/notes** → debounced `writeMetadata`.
6. **Linked image** → on model open, `readLinkedImage` populates the info pane's reference section. Drag-drop/paste → `writeLinkedImage(bytes, ext)` → store updates `linkedImage` in the sidecar; **Detach** → `removeLinkedImage` + clear the field.
7. **Prev/Next** → advance selection within the current folder's file list.
8. **Single-file launch** → `onOpenFile(path)` → scan parent folder, select the file, enter Viewer.

## Error handling

- **Corrupt/unparseable STL:** worker returns an error → placeholder tile / inline viewer message. Never crash the app.
- **Permission failures** writing `.meta`/`.thumb`: surface a non-blocking toast; keep edits in memory for the session.
- **Missing/locked files:** skip with a notice; keep the rest of the grid working.
- **Thumbnail render failure:** fall back to a generic model icon.
