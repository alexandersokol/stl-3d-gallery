# 06 — Performance

[← Back to index](_INDEX.md)

"Fast model loading" is a core requirement. The strategy: never block the UI thread, do work lazily, and cache aggressively.

## Off-main-thread parsing

- STL parsing runs in a **Web Worker** (`stl-worker`), not on the renderer's UI thread.
- Parsed geometry is transferred back via transferable `ArrayBuffer`s to avoid copies.
- A large or slow model therefore never freezes scrolling, panel edits, or navigation.

## Progressive folder loading

- `scanFolder` returns the file list fast (names + stat), so the **grid renders immediately** with placeholder tiles.
- Thumbnails and geometry are fetched **after** the grid is on screen.

## Virtualized grid

- `GridView` renders only the tiles in (or near) the viewport.
- Scrolling a folder of thousands of models stays smooth; off-screen tiles do no work.

## Lazy, cached thumbnails

- A tile requests its thumbnail only when it becomes (nearly) visible.
- **Cache hit** (`.thumb/<name>.png`, mtime-valid) → display immediately, no parsing.
- **Cache miss** → parse in worker → offscreen render → write cache → display.
- Concurrency is bounded (a small worker/render pool) so a huge folder doesn't spawn unbounded work.

## Viewer efficiency

- Reuse a single renderer/scene; swap geometry rather than rebuilding the scene per model.
- Compute vertex normals only when absent from the source.
- Dispose old geometries/materials on model switch to avoid GPU memory growth.

## Targets (informal)

- A folder of a few hundred STLs: grid visible in well under a second; thumbnails stream in.
- Switching Prev/Next on already-cached models feels instant.
- Opening a large (tens-of-MB) STL shows a loading indicator but keeps the UI fully responsive.
