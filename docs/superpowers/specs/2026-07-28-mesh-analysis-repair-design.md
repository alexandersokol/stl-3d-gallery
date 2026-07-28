# Mesh Analysis & Repair ("Mesh Repair" tools)

Date: 2026-07-28
Status: approved, implementing

## Goal

Add Blender-3D-Print-toolbox-style tooling to the viewer's right pane: an
**Analyze** button that reports mesh issues (watertightness, holes,
non-manifold edges, degenerate triangles), and a **Fix Manifold** button,
gated by a checkbox group (weld / clean / fill holes / full manifold), that
writes a repaired copy of the model.

## Key technical reality

STL is "triangle soup": every triangle stores its own three vertices with no
sharing. Manifold/topology analysis is only meaningful *after* welding
coincident vertices (Blender relies on the same "merge by distance" step). So
every topology operation here first welds onto a tolerance grid to build an
indexed mesh, then classifies each undirected edge by the number of faces that
use it: 1 = boundary (hole), 2 = manifold, >=3 = non-manifold.

`watertight = boundaryEdges === 0 && nonManifoldEdges === 0`.

## Architecture

Pure, worker-run, unit-tested modules (same discipline as `stl-parser.ts` — no
three.js / DOM / fs):

- `src/renderer/lib/mesh-topology.ts` — `weldVertices(positions, tol?)`
  (merge-by-distance → `{ positions, indices, tol }`), `triangleArea2`,
  `boundaryLoops(indices)` (assembles directed boundary half-edges into loops
  for hole filling), and edge-key helpers. Shared by analysis and repair.
- `src/renderer/lib/mesh-analysis.ts` — `analyzeMesh(positions): MeshAnalysis`.
- `src/renderer/lib/mesh-repair.ts` — `repairMesh(positions, RepairOptions): Float32Array`.
  Composable passes in order: **weld** → **clean** (drop degenerate + duplicate
  triangles) → **fillHoles** (fan-triangulate boundary loops) → **fullManifold**
  (best-effort: remove faces on non-manifold edges, then re-fill). `fillHoles`
  and `fullManifold` require topology, so they force welding internally.
- `src/renderer/lib/stl-writer.ts` — `writeBinarySTL(positions): ArrayBuffer`
  (per-face normals from winding; round-trips with `parseSTL`).

These run off the UI thread in a one-shot `src/renderer/workers/mesh-ops.worker.ts`
(mirrors `stl.worker.ts`), driven by `src/renderer/lib/mesh-ops.ts` glue
(mirrors `load-model.ts`): `analyzeModel(bytes)` and `repairModel(bytes, options)`.
The worker re-parses the file bytes itself, so no geometry is stashed in the store.

## Data flow

- **Analyze:** panel → `api.readFileBytes(path)` → `analyzeModel` → render report.
- **Fix:** panel → read bytes → `repairModel(options)` → new STL `ArrayBuffer`
  → new IPC `writeStlFile(sourceModel, bytes)` (main writes a collision-safe
  sibling `<name>-fixed.stl`, `-fixed-2.stl`, …) → `store.openRepairedFile(path)`
  rescans the folder and switches the viewer to the new file (its thumbnail
  regenerates automatically — the cache is keyed by path + mtime). The original
  is never touched.

## New surface area

- `shared/types.ts`: `MeshAnalysis`, `RepairOptions`; `Api.writeStlFile`.
- `preload/index.ts` + `renderer/ipc/api.ts`: `writeStlFile`.
- `main/ipc.ts` + `main/file-ops.ts`: `writeRepairedModel(sourceModel, bytes)`
  (collision-safe `-fixed` naming, writes bytes, returns `{ path }`).
- `renderer/state/store.ts`: `openRepairedFile(path)` (thin wrapper over the
  existing `openAfterOp` reconcile helper).
- `renderer/components/MeshRepairPanel.tsx`: the UI section, mounted in
  `InfoPanel` below Reference Image. Local component state (analysis result,
  running flags, checkbox options, errors); all reset on model change.

## Report contents

Watertight ✓ (green) when clean, otherwise the issue counts: boundary edges
(holes), non-manifold edges, degenerate triangles. Plus neutral info: triangle
count and unique (welded) vertex count. `duplicateVertices` (coincident vertex
instances that weld away) is shown as neutral info, not an error — it is
nonzero for every healthy STL and does not affect watertightness.

## Error handling

Worker parse/OOM failures and disk-write failures surface as inline error text
in the panel; the viewer never crashes. Empty/zero-triangle meshes report
gracefully. Fix is disabled when no checkbox is ticked. `-fixed` name
collisions auto-increment.

## Testing

- `mesh-topology.test.ts`: weld reduces vertex count; boundary-loop assembly.
- `mesh-analysis.test.ts`: closed tetrahedron = watertight; one-face-removed =
  boundary edges; edge-shared-by-3-faces = non-manifold; degenerate-tri fixture.
- `mesh-repair.test.ts`: clean drops degenerate; fillHoles closes a hole
  (re-analysis watertight); fullManifold removes non-manifold edges.
- `stl-writer.test.ts`: `writeBinarySTL` → `parseSTL` round-trip.
- `file-ops.test.ts`: `writeRepairedModel` writes `-fixed.stl` and dedupes.
- `MeshRepairPanel` DOM test: buttons render, report shows, Fix disabled with no
  options.

## Caveats

- **Full manifold** is genuinely best-effort — robustly resolving non-manifold
  junctions in pure JS is hard, and on pathological meshes it removes geometry
  rather than perfectly repairing it. Weld + Clean + Fill holes covers the
  overwhelming majority of real STL problems reliably.
- Fan-triangulating arbitrary boundary loops can occasionally produce
  non-planar or self-intersecting patches; acceptable for a first version.
