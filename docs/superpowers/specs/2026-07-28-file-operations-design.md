# File operations (rename / copy / move / delete) — design

**Date:** 2026-07-28
**Status:** approved

## Goal

Give the user file-manager operations on a model — **rename, copy, move,
delete** — that also carry the model's sidecar files (metadata, thumbnail,
linked image). Exposed as icon buttons in the viewer info pane and as a ⋮
dropdown on grid tiles, plus F2 / Delete shortcuts in the viewer.

**Decisions:** Delete → OS Trash (recoverable). Copy → switch to the new copy.

## Sidecar model

Every sidecar is named `<model-basename><suffix>` and lives in a hidden sibling
dir:

- `.meta/<base>.json`
- `.thumb/<base>.v<N>_<preset>.png` (possibly several; plus a legacy `<base>.png`)
- `.linked/<base>.<ext>` (name recorded in `metadata.linkedImage`)

So one generic routine carries all sidecars by swapping the basename prefix:
for each file in `.meta/.thumb/.linked` whose name starts with `<oldBase>.`,
the new name is `<newBase>` + `name.slice(oldBase.length)`.

- **Rename / Copy:** basename changes → sidecar names change; also rewrite the
  (moved/copied) `metadata.linkedImage` to `<newBase>` + `linkedImage.slice(oldBase.length)`.
- **Move:** basename unchanged → sidecar names unchanged; only the parent dir
  changes; no metadata edit needed.

## Components

### Main — `src/main/file-ops.ts`
- `renameModel(model, newName)` → `{ path }`. Validate; guard destination
  doesn't exist; move STL + sidecars; fix `linkedImage`.
- `copyModel(model, newName)` → `{ path }`. Same as rename but copies.
- `moveModel(model, targetDir)` → `{ path }`. Guard `targetDir !== dirname(model)`
  and destination doesn't exist; move STL + sidecars keeping the name. (The
  native folder picker is opened by the IPC handler, which then calls this.)
- `deleteModel(model)` → `void`. `shell.trashItem` on the STL + each existing
  sidecar.

### Shared — `src/shared/filename.ts`
`validateStlFilename(name): { ok: true } | { ok: false; error: string }`:
non-empty; no path separators; no illegal chars ``< > : " / \ | ? *`` or
control chars; must end in `.stl` (case-insensitive). Used by the dialog (live)
and by main (authoritative). Collision is checked in main (`fs`).

### IPC / preload / renderer api
Add `renameModel(model, newName)`, `copyModel(model, newName)`,
`moveModel(model)` (opens native dir picker; returns `{ path }` or `null`),
`deleteModel(model)`.

### State — store
- `fileAction: { kind: 'rename' | 'copy' | 'delete'; path } | null`.
- `beginFileAction(kind, path)`; `closeFileAction()`; `moveFile(path)` (runs
  immediately via the native picker).
- `confirmRename(newName)` / `confirmCopy(newName)` / `confirmDelete()` → call
  IPC, then re-scan `cwd` and reconcile selection:
  - rename → follow the model to its new path;
  - copy → select the new copy;
  - move / delete → advance to next model, else back to grid.
- `refreshFolder(targetPath?)` helper: re-scan `cwd`, set `selectedIndex` to
  `targetPath`'s index (or clamp / return to grid).

### UI
- **InfoPanel:** a row of 4 icon-only buttons (rename/copy/move/delete) under
  the name/path, each with `aria-label` + `title`.
- **ModelTile:** a ⋮ (more_vert) button top-right; a dropdown with icon+text
  items. The button and menu stop click propagation so the tile doesn't open.
- **FileActionDialogs** (mounted once in App): name-input modal (rename/copy,
  pre-filled, inline validation, Cancel/OK) and delete-confirm modal; reuses the
  settings-overlay styles, Esc/backdrop close.
- New inlined SVG icons: `edit`, `content_copy`, `drive_file_move`, `delete`,
  `more_vert`.

### Shortcuts
App.tsx global handler (viewer mode, non-typing target): `F2` → rename current;
`Delete` → delete current.

## Tests
- Main `file-ops`: rename/copy/move carry every sidecar and fix `linkedImage`;
  delete trashes all (shell mocked); collision + same-dir guards throw.
- Shared `validateStlFilename`: each rule.
- Renderer: dialog validation + Cancel/OK; ModelTile menu opens and dispatches;
  InfoPanel buttons dispatch; store reconciles selection after each op.

## Out of scope
Folder/subfolder operations; multi-select batch operations; overwrite-on-collision
(collisions error instead).
