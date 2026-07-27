# 01 — Overview & Scope

[← Back to index](_INDEX.md)

## Vision

A fast, offline desktop tool that treats a folder of STL 3D-print files the way an image viewer treats a folder of photos: open it, see thumbnails, browse, search, and preview. Add a real-time 3D viewer on top so each model can be rotated, re-lit, and re-materialed, plus lightweight metadata (tags, notes) to make a growing collection searchable.

## Goals

- **Offline-first.** No network, no accounts, no cloud. Everything works on local files.
- **Fast.** Folders open instantly; thumbnails and model loads never block the UI.
- **Familiar.** Browse-and-preview flow mirrors an image gallery.
- **Portable metadata.** Tags/notes and thumbnails live next to the models so they travel when a folder is copied.
- **Cross-platform.** macOS and Windows from one codebase.

## In scope (v1)

- Open a folder; browse its STL files as a thumbnail grid.
- Recurse into subfolders with breadcrumb navigation (subfolders shown as tiles).
- Open as the **default preview app** for a single `.stl` file (see [UX](02-ux-and-layout.md#single-file-open)).
- Interactive 3D viewer: rotate, pan, zoom, material presets, lighting presets.
- Prev/Next navigation through the current folder.
- Per-model metadata: **tags** and **notes**, editable in-app.
- Per-model **linked reference image** (e.g. a screenshot or the source image the model was made from), shown in the info pane; attach via drag-drop or clipboard paste, detach to remove.
- Search by filename; filter by tags (optionally across subfolders).
- Model info: file size, triangle/vertex count, bounding-box dimensions.
- Thumbnail generation and on-disk caching.
- Packaged installers via electron-builder (unsigned).

## Explicitly out of scope (v1)

These are deliberately excluded to keep v1 focused. They may be revisited later.

- **Mesh editing or repair** — no fixing non-manifold geometry, no boolean ops, no decimation.
- **Measuring tools** — no calipers, cross-sections, or dimension annotations beyond the bounding box.
- **Multiple formats** — STL only. No OBJ / 3MF / PLY / STEP.
- **Persistent multi-root library** — no remembered set of watched folders or global index. The app opens one folder at a time (it may remember only the *last* folder for a reopen convenience).
- **Code-signing / notarization** — installers are produced unsigned.
- **Multiple linked images per model** — v1 supports a single linked reference image (attach replaces, detach removes). A gallery of several images is a possible future extension.

## Success criteria

- Opening a folder of a few hundred STLs shows the grid immediately, with thumbnails filling in progressively.
- Opening a large model does not freeze the UI.
- Tags/notes survive copying a folder to another machine.
- Double-clicking an `.stl` in the OS file manager (once associated) opens it directly in the viewer.
