# STL Gallery — Project Wiki

An offline desktop app to browse folders of STL files like an image gallery, preview each model in 3D, and tag/annotate them.

> **Status:** Design phase. This wiki is the source of truth for what we're building and why. Implementation has not started.

## One-line pitch

Like an image gallery, but for 3D models — open a folder, see thumbnails, search/filter by tags, and preview any model in an interactive 3D viewer with material and lighting presets.

## Documents

| # | Document | What's inside |
|---|----------|---------------|
| 01 | [Overview & Scope](01-overview.md) | Vision, goals, in-scope features, explicit out-of-scope for v1 |
| 02 | [UX & Layout](02-ux-and-layout.md) | Two modes, collapsible panes, navigation, single-file open, keyboard shortcuts, info panel, empty state |
| 03 | [Architecture](03-architecture.md) | Electron process model, security, module breakdown, IPC, data flow |
| 04 | [Data Formats](04-data-formats.md) | Metadata sidecars (`.meta/`), thumbnail cache (`.thumb/`), linked images (`.linked/`), units convention |
| 05 | [3D Viewer](05-viewer.md) | three.js scene, material presets, lighting presets, camera controls |
| 06 | [Performance](06-performance.md) | Workers, virtualization, lazy/cached thumbnails, progressive loading |
| 07 | [Tech Stack](07-tech-stack.md) | React + Vite + TypeScript, Electron, electron-builder, key dependencies |
| 08 | [Testing Strategy](08-testing.md) | Unit, component, and E2E approach; fixtures; TDD |

## Key decisions at a glance

- **Platform:** Electron (macOS + Windows), TypeScript throughout.
- **UI:** React + Vite. three.js driven imperatively inside a viewer component.
- **Library model:** open-a-folder (transient), recurse with breadcrumb navigation.
- **Formats:** STL only (binary + ASCII) for v1.
- **Metadata:** per-model JSON sidecar in a `.meta/` subfolder.
- **Thumbnails:** per-model PNG in a `.thumb/` subfolder, cached by mtime.
- **Linked reference image:** per-model image in a `.linked/` subfolder, shown in the info pane; attach/detach via drag-drop or clipboard paste.
- **Packaging:** electron-builder → unsigned macOS `.dmg` + Windows installer.
