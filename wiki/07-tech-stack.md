# 07 — Tech Stack

[← Back to index](_INDEX.md)

## Core

| Concern | Choice | Notes |
|---------|--------|-------|
| Shell | **Electron** | Cross-platform desktop (macOS + Windows) |
| Language | **TypeScript** | Main, preload, and renderer |
| UI framework | **React** | Panes, grid, toolbar, state-driven UI |
| Bundler / dev server | **Vite** | Fast HMR; renderer build |
| 3D | **three.js** | Driven imperatively in the viewer component |
| State | **Zustand** | Lightweight global store for the renderer |
| Packaging | **electron-builder** | macOS `.dmg` + Windows installer, **unsigned** |

## three.js pieces used

- `STLLoader` (binary + ASCII parsing, run inside the worker)
- `OrbitControls`
- `RoomEnvironment` + `PMREMGenerator` (procedural PBR environment)
- `MeshStandardMaterial` / `MeshPhysicalMaterial` / `MeshMatcapMaterial` / `MeshNormalMaterial`

## Icons

- UI icons come from **Google Fonts — Material Symbols** (the toolbar, pane toggles, attach/detach, nav arrows, etc.).
- **Bundled locally, not fetched at runtime.** The app is offline-first, so the needed icons are downloaded from the Google Fonts resource and committed into the repo (as an SVG set and/or the self-hosted variable font). No CDN or network request at runtime.
- Only the icons actually used are included, kept in one place (e.g. `renderer/assets/icons/`) so the set is easy to audit and extend.

## Testing tools

See [Testing Strategy](08-testing.md).

- **Vitest** — unit tests.
- **React Testing Library** — component tests.
- **Playwright** (Electron) — one end-to-end smoke test.

## Project scaffolding notes

- An Electron + Vite + React + TS template (e.g. `electron-vite`) is a reasonable starting point, adjusted to the module layout in [Architecture](03-architecture.md).
- `.gitignore` must include build output, `node_modules`, and `.superpowers/` (visual-brainstorm scratch).
- Repo currently lives under a `Python/` parent directory by accident of location; this is a JS/TS project — no Python involved.

## File association (packaging)

- electron-builder `fileAssociations` entry registers `.stl` so the app can be set as the default STL preview app. Consumed at runtime per [UX → single-file open](02-ux-and-layout.md#single-file-open).
