# 08 — Testing Strategy

[← Back to index](_INDEX.md)

Development follows **TDD**: write a failing test, make it pass, refactor. Tests are organized to match the module boundaries in [Architecture](03-architecture.md).

## Unit tests (Vitest)

| Target | What's verified |
|--------|-----------------|
| `fs-scanner` | Lists STL files and subfolders; ignores `.meta`/`.thumb`; handles empty/missing dirs (fs mocked) |
| `metadata-store` | Round-trips a sidecar; handles missing file → null; path mapping `123.stl` → `.meta/123.stl.json` |
| `thumbnail-cache` | Path mapping to `.thumb/123.stl.png`; mtime-based staleness check |
| `linked-image-store` | Write image → `.linked/123.stl.<ext>` + sidecar `linkedImage` set; replace removes old file; detach deletes file + clears field |
| `stl-worker` parse | Parses tiny **binary** and **ASCII** STL fixtures → correct triangle/vertex counts + bbox |
| `materials` / `lighting` | Preset factory returns the expected material/light types for each preset name |
| search / filter | Filename search and tag filtering (incl. "include subfolders") produce correct result sets |

## Component tests (React Testing Library)

- **GridView:** renders tiles for a file list; placeholder → thumbnail swap.
- **TagFilterBar / SearchBox:** selecting a tag / typing a query narrows the visible set.
- **InfoPanel:** editing tags/notes triggers a debounced save call; renders stats.
- **Reference image:** empty drop zone → dropping/pasting an image calls `writeLinkedImage`; attached preview → Detach calls `removeLinkedImage`.
- **Pane toggles / mode toggle:** show/hide filmstrip and info; switch Grid ⇆ Viewer.

## End-to-end (Playwright for Electron)

One smoke test covering the golden path:

1. Launch app → open a fixture folder.
2. Grid shows the fixture models.
3. Click a model → Viewer opens and renders.
4. `→` advances to the next model.
5. Add a tag → assert `.meta/<name>.json` is written.

## Fixtures

- A couple of **tiny STL files** (e.g. a unit cube) in both **binary** and **ASCII** encodings.
- A small fixture folder with a subfolder, to exercise breadcrumb navigation and recursion.

## Non-goals for automated testing (v1)

- Pixel-level correctness of the 3D render (visual/GPU output) is validated manually, not asserted in CI.
- Cross-platform packaging output is verified by manual smoke installs.
