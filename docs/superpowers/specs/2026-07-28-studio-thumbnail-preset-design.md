# Studio thumbnail-renderer preset — design

**Date:** 2026-07-28
**Status:** approved

## Goal

Add a dedicated **thumbnail-renderer preset** whose coloring, material,
shadows, and lighting look **absolutely identical** in the offscreen
thumbnail render and in the live 3D preview. It is the default preset for
thumbnails and is also selectable in the 3D preview's material picker, where
it appears **last**.

Reference: 6 user-supplied images of a smooth lavender "studio clay" — a cool
near-white highlight upper-left, a light lavender-grey body, and a deep cool
purple-blue silhouette edge, on a dark radial-vignette tile background.

## Why matcap

The thumbnailer (`thumbnailer.ts`) and the live viewer (`SceneManager.ts`)
are two separate render paths with **different light rigs** (thumbnailer:
hemisphere + one key light; viewer: 4-light studio rig + env map). Any *lit*
material (e.g. the current `clay` = `MeshStandardMaterial`) therefore shades
differently between a thumbnail and the 3D preview.

A `MeshMatcapMaterial` bakes the key light, soft-shadow falloff, and color
into a single texture and **ignores** the scene's lights/environment. That is
what guarantees pixel-identical shading across both paths — the explicit
requirement here.

**Accepted tradeoff:** for this preset only, the lighting picker and
base-color controls have no effect (that independence is exactly what makes
the two paths match). All other presets keep responding to them.

## Look

Procedurally generated (asset-free, offline) via the existing `drawMatcap()`
in `matcaps.ts` — a radial gradient lit from the upper-left. Lavender stops,
tuned by rendering real test-model thumbnails and comparing to the reference
images until they match.

## Changes

| Change | File |
|---|---|
| Add `'studio'` to `MaterialPreset`; append it **last** in `MATERIAL_PRESETS` | `materials.ts` |
| `makeMaterial('studio', …)` → `MeshMatcapMaterial({ matcap: matcaps.studio })` | `materials.ts` |
| Repurpose the currently-unused `clay` matcap slot → `studio` (lavender); change the matcap record type `'clay' \| 'ceramic'` → `'studio' \| 'ceramic'` and update its usages | `matcaps.ts`, `materials.ts`, `SceneManager.ts` |
| Default thumbnail preset `clay` → `studio` (default value + `localStorage` fallback) | `store.ts` |
| Bump `THUMB_RENDER_VERSION` so cached thumbnails regenerate | `thumbnail-cache.ts` |

**Unchanged:** 3D-preview default material stays `clay`; `clay`/`matte`/
`glossy`/`metal` still respond to the lighting picker + base color; thumbnails
stay transparent PNGs (the tile's dark background supplies the vignette).

## Tests

- `materials.dom.test.ts`: `studio` → `MeshMatcapMaterial`; present in
  `MATERIAL_PRESETS`; listed last.
- `matcaps`: `makeMatcaps()` returns a `studio` texture.
- `SettingsModal`/store: default thumbnail preset is `studio`; stored-value
  fallback resolves to `studio`.

## Verification

Typecheck + full unit suite green; render real `test-models` thumbnails and
visually confirm the Studio look matches the references and is identical in
the 3D preview.
