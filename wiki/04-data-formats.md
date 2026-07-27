# 04 — Data Formats

[← Back to index](_INDEX.md)

Metadata and thumbnails are stored **next to the models**, inside hidden subfolders, so they travel with a folder when it is copied or moved. Nothing is written to a central app database.

## Layout on disk

For a model at `/prints/dragons/123.stl`:

```
/prints/dragons/
├── 123.stl                 ← the model
├── .meta/
│   └── 123.stl.json        ← metadata sidecar
├── .thumb/
│   └── 123.stl.png         ← cached thumbnail
└── .linked/
    └── 123.stl.png         ← linked reference image (original extension)
```

- **Metadata:** `<dir>/.meta/<filename>.json` — e.g. `123.stl` → `.meta/123.stl.json`.
- **Thumbnail:** `<dir>/.thumb/<filename>.png` — e.g. `123.stl` → `.thumb/123.stl.png`.
- **Linked image:** `<dir>/.linked/<filename>.<ext>` — e.g. `123.stl` → `.linked/123.stl.png` (see [below](#linked-images)).

The `.meta/`, `.thumb/`, and `.linked/` folders are created lazily on first write. They are ignored by the grid listing (never shown as content).

## Metadata sidecar

JSON, one file per model. Illustrative schema:

```jsonc
{
  "schemaVersion": 1,
  "tags": ["dragon", "minis"],
  "notes": "Printed at 0.1mm layer height, needs supports on wings.",
  "linkedImage": "123.stl.png",   // filename within .linked/, or absent if none
  "updatedAt": "2026-07-27T12:00:00Z"
}
```

- Written debounced after edits in the info panel.
- Missing sidecar = a model with no metadata (empty tags, empty notes, no linked image) — perfectly valid.
- `linkedImage` is the filename of the reference image inside the sibling `.linked/` folder; absent when no image is attached.
- `schemaVersion` allows forward-compatible migrations.
- The tag index used for search/filter is built in memory by reading sidecars during a folder scan.

## Thumbnail cache

- A rendered PNG of the model on a neutral background.
- **Invalidation by mtime:** a thumbnail is considered stale if the source STL's modified-time is newer than the thumbnail's. Stale/missing thumbnails are re-rendered on demand. (The mtime check lives in `thumbnail-cache`.)
- Safe to delete at any time — the app regenerates them.

## <a id="linked-images"></a>Linked reference image

An optional single image linked to a model — a print screenshot or the source image the model was made from. Shown in the info pane during 3D preview (see [UX](02-ux-and-layout.md#linked-image)).

- **Location:** `<dir>/.linked/<filename>.<ext>`, e.g. `123.stl` → `.linked/123.stl.png`.
- **Original extension preserved:** accepted types are PNG, JPG/JPEG, WebP, GIF. A pasted clipboard image is saved as `.png`.
- **Deterministic lookup:** the exact filename is recorded in the sidecar's `linkedImage` field, so the app never has to guess the extension.
- **Attach** (drag-drop or paste) writes the bytes into `.linked/` and sets `linkedImage`. Attaching when one already exists **replaces** it (the previous file is removed).
- **Detach** deletes the file from `.linked/` and clears `linkedImage`.
- The `.linked/` folder is portable — it travels with the folder like `.meta/` and `.thumb/`.

## <a id="units"></a>Units convention

STL files carry **no unit information**. The app assumes **millimeters (mm)**, the near-universal convention for 3D-printing STLs, and labels bounding-box dimensions accordingly. This is a display assumption only; no scaling is applied to geometry.
