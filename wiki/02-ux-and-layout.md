# 02 — UX & Layout

[← Back to index](_INDEX.md)

The app is a single window with a top toolbar and two primary **modes**. Side panes collapse independently so the user can go from a full browsing grid to a distraction-free 3D view.

## Modes

### Full Grid mode
- Thumbnail grid of the current folder fills the window.
- **Breadcrumb navigation:** the current path is shown as a breadcrumb; subfolders appear as folder tiles you can drill into, and the breadcrumb walks back out.
- **Search** by filename and **filter** by tags.
- Optional **"include subfolders"** toggle so search/filter can span the whole tree beneath the current folder (off by default — normally you browse one folder at a time).
- Clicking a model thumbnail switches to **Viewer** mode on that model.

### Viewer mode
Three regions, the two side ones independently collapsible:
- **Left — Filmstrip pane** (collapsible): a compact mini-grid of the current folder plus a search box, for quick jumps without leaving the viewer.
- **Center — 3D viewer:** the model, orbit/pan/zoom, material & lighting preset controls, Prev/Next. See [3D Viewer](05-viewer.md).
- **Right — Info/Metadata pane** (collapsible): model stats and editable tags/notes.

The toolbar exposes: **Grid ⇆ Viewer** mode toggle, **Filmstrip** show/hide, **Info** show/hide, the current folder path, and search/tag controls (contextual to mode).

## Navigation

- **Prev/Next** walks the current folder's ordered list of STL files. Buttons in the viewer plus keyboard arrows.
- Subfolder tiles change the current folder (and therefore the Prev/Next set).

### Keyboard shortcuts
| Key | Action |
|-----|--------|
| `←` / `→` | Previous / next model |
| `Esc` | Return to Full Grid from Viewer |
| `F` | Toggle filmstrip pane |
| `I` | Toggle info/metadata pane |

## <a id="single-file-open"></a>Single-file open (default preview app)

The app can be registered as the default handler for `.stl` files. When a user opens a single `.stl` from the OS file manager:

1. The app resolves the file's **parent folder** and scans it (as if that folder were opened).
2. It lands directly in **Viewer** mode with the opened file selected and rendered.
3. **Prev/Next** then navigates the sibling files in that folder as usual.

Platform mechanics:
- **macOS:** handled via the Electron `open-file` app event (fires for Finder "Open With" / double-click, including while the app is launching).
- **Windows:** the file path arrives as a process argument (`process.argv`); file association is declared in the electron-builder config.

## Info / Metadata pane contents

- **Identity:** filename, full path.
- **Geometry stats:** file size, triangle count, vertex count, bounding-box dimensions (assumed **millimeters** — STL is unitless; see [Data Formats](04-data-formats.md#units)).
- **Tags:** add/remove chips; feed the tag filter.
- **Notes:** free-text, multi-line.
- **Reference image:** see below.
- Edits are debounce-saved to the model's sidecar (see [Data Formats](04-data-formats.md)).

> Volume / surface-area readouts are intentionally left out of v1.

### <a id="linked-image"></a>Linked reference image

The info pane includes a **Reference image** section for a single linked image per model — typically a screenshot of the print or the source image the model was created from.

- **Empty state:** a drop zone reading "Drag an image here, or paste (⌘/Ctrl+V)."
- **Attach — drag & drop:** drop an image file (PNG/JPG/WebP/GIF) onto the zone (or the info pane) to attach it.
- **Attach — clipboard paste:** with the viewer/info pane active, `⌘/Ctrl+V` attaches an image from the clipboard (e.g. a screenshot). Paste replaces any existing linked image.
- **Attached state:** a preview of the image with a **Detach** control. Clicking the preview opens it enlarged.
- **Detach:** removes the link (deletes the file from `.linked/` and clears the sidecar reference).

Storage lives in `.linked/` alongside `.meta/` and `.thumb/` — see [Data Formats](04-data-formats.md#linked-images).

## Empty state & launch

- On launch with no file argument, show an **"Open a folder"** prompt.
- The app remembers the **last opened folder** and offers a one-click reopen. This is the only persisted location state — there is no multi-root library.
