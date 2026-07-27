# 05 — 3D Viewer

[← Back to index](_INDEX.md)

The viewer uses **three.js driven imperatively** inside a React component (not react-three-fiber) for tight control and predictable performance with a single model.

## Scene basics

- **Renderer:** WebGL, antialiased, sized to the viewer pane, responsive on resize.
- **Camera:** perspective, **auto-fit** to the model's bounding box on load so any model fills the frame sensibly.
- **Controls:** `OrbitControls` — rotate (drag), pan (right/modifier-drag), zoom (wheel/pinch), with damping.
- **Helpers/toggles:** camera **reset**, **auto-rotate** toggle, **ground-grid** toggle, **background** light/dark toggle.
- **Environment:** PBR reflections come from three.js **`RoomEnvironment`** — a procedurally generated neutral studio environment, so no HDRI asset files are bundled.

## Material presets

Six presets, chosen to read STL **form** well (STL has no color/UV data). A **base-color** picker applies to the lit presets; MatCap presets are lighting-independent and ignore base color.

| Preset | Implementation | Why it's useful for STL |
|--------|----------------|--------------------------|
| **Matte** | `MeshStandardMaterial`, high roughness, metalness 0 | Neutral, even shading; reads overall shape without glare |
| **Glossy** | Low roughness (optionally `MeshPhysicalMaterial` clearcoat) | Highlights reveal curvature and surface transitions |
| **Metal** | `metalness: 1`, moderate roughness, env reflections | Polished look; reflections emphasize contours |
| **Clay (MatCap)** | `MeshMatcapMaterial` (clay/wax matcap) | Classic sculpt-preview; superb, lighting-independent form reading |
| **Studio ceramic (MatCap)** | `MeshMatcapMaterial` (neutral studio matcap) | Clean, presentation-friendly form reading |
| **Wireframe / Normals** | `wireframe` overlay or `MeshNormalMaterial` | Inspect topology and normal orientation |

MatCap textures are small bundled PNGs. Normals shading needs no lighting.

## Lighting presets

Applied to the lit materials (MatCap presets are unaffected). A global **intensity** slider scales the active setup.

| Preset | Setup | Character |
|--------|-------|-----------|
| **Studio** (default) | 3-point: key + fill + rim, plus soft ambient | Balanced, shows form and edges |
| **Soft / Even** | Hemisphere + low ambient, minimal shadow | Neutral inspection, flattest |
| **Dramatic** | Single strong key, low fill | High contrast, emphasizes surface detail |
| **Top-down** | Overhead key | Print-bed-like, reads footprint |

## Interaction summary

- Prev/Next and keyboard nav are described in [UX & Layout](02-ux-and-layout.md#navigation).
- Switching models keeps the current material/lighting/camera preferences where sensible (e.g. keep the chosen material; re-fit the camera to the new model).
