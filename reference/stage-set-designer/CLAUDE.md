# Seed Designer

Parametric CAD tool for laser-cut/3D-printed stage panels and festival-style
sculptural assemblies. React 19 + TypeScript + Vite + Zustand. No backend —
everything lives in the browser (localStorage persistence + a Web Worker for
heavy geometry compute).

Repo: https://github.com/viatekh/seed-designer (private)

## What this app does

- **Components**: a parametric panel — a `ShapePrimitive` outline (rect,
  star, freeform, feather, etc. — 15+ kinds) filled with a fractal/organic
  cut pattern (`PatternConfig`: voronoi, hexagon, vein, circuit, and more),
  with recursion, symmetry, dispersion, a center hole, edge decoration, and
  a second independent surface-detail pattern. Exports to SVG (laser
  cutting) and STL (3D printing/preview).
- **Arrangements**: place multiple instances of a component (or several
  components across layers) into an assembly — a radial flower, a
  tessellated grid, or a hand-placed compound shape — and preview it as a
  real extruded 3D solid.

## Architecture map

- `src/lib/geometry/` — the pure geometry pipeline. `pipeline.ts` computes
  one component's flat cut/etch geometry; `arrangement.ts` combines
  multiple placed instances into 2D layer outlines (booleans via Clipper2);
  `arrangementMesh.ts` builds the 3D preview's extruded meshes instead.
  `geometry.worker.ts` / `geometryWorkerClient.ts` run all of this off the
  main thread — component geometry, arrangement geometry, and mesh building
  are three request `kind`s on one shared worker with per-caller request
  coalescing (so a slider drag never queues a backlog).
- `src/store/designerStore.ts` — the single Zustand store (project data,
  persisted to localStorage). Has a **versioned migration chain** (current
  `version: 18`) — every schema change since the project started gets a
  numbered backfill step, all consolidated in
  `src/lib/migration/backfillProject.ts` (shared by both the localStorage
  migrate hook and file import — a real bug fixed this session: file import
  used to skip all backfill).
- `src/components/canvas/` — the flat 2D SVG views (single-component editor,
  "Flat layers" arrangement export view).
- `src/components/canvas3d/` — the 3D preview (`@react-three/fiber` +
  `@react-three/drei`). `Arrangement3DView.tsx` is the entry point.
- `src/components/panels/` — the right-hand sidebar controls.

## The Arrangement/placement model (this session's main work)

An `Arrangement` has `layers: ArrangementLayer[]`. Each layer references one
component and a **generator** (`PlacementGenerator` in
`lib/geometry/types.ts`) that decides where instances go:

- **Radial** — count/radius/startAngle/arcSpan/autoOrient/instanceRotation/
  alternateMirror, plus `axis` ('z'/'x'/'y' — which plane the ring lies in,
  so it can stand up vertical for a totem/crown) and `tiltDeg`/`swivelDeg`
  (two independent cant axes, stored as rotationX/rotationY).
- **Grid** — rows/cols/spacingX/spacingY/staggerOffset, plus the same
  `tiltDeg`/`swivelDeg` (uniform per tile, not yet a per-tile curvature).
- **Manual** — a directly-authored `Instance3D[]` list (x/y/z +
  rotationX/Y/Z + mirrored per instance), for one-off asymmetric compound
  builds nothing else fits.

`layer.depth` is that layer's own independent Z-offset from the base (NOT
cumulative — this was a real bug: changing one layer's depth used to
cascade and move every layer above it too, fixed by making each layer's
world Z depend only on its own `depth`).

Each component's own pattern geometry stays a flat 2D sheet (physically
correct — it's a cut panel); only *where/how* that flat sheet sits in space
is 3D. `combineInstances`/`booleanCombine.ts` (union/subtract/intersect/
exclude across instances) only ever operates on the flat 2D projection —
`'none'` mode is the required no-crash path for non-coplanar Grid/Manual
layers, and switching a layer's generator kind always resets `combineMode`
to `'none'` so a stale boolean mode can't silently produce a
geometrically-wrong result.

### 3D preview specifics

`buildComponentMesh` (in `lib/export/stlExport.ts`, originally built for
STL export) is reused verbatim to build each layer's extruded solid — one
mesh per layer, triangulated once, then cheaply reused across every
instance via a position+rotation transform (never re-triangulated per
instance). Triangulation is genuinely expensive (see `triangulate.ts`'s
`MAX_EXPORT_VERTICES` budget), which is why meshing runs in the worker.

Rotation composition order (documented on `Instance3D` in
`lib/geometry/types.ts`, and matched by `Arrangement3DView`'s Three.js
Euler `'ZXY'` order): **rotationZ (facing) → rotationX (tilt) → rotationY
(swivel)**, each intrinsic/local-axis, applied before translating to
(x, y, z). Get this order wrong and tilt/swivel will visibly rotate around
the wrong axis.

Each layer renders in a distinct color (cycling an 8-color palette) so a
multi-layer stack reads clearly without hide/solo.

### Calibrate scale

A tool in the 3D view: click two points on any panel (R3F's built-in
raycasting gives the world-space hit as `event.point`, no manual
`Raycaster` needed), type the real-world mm distance they should be, Apply
— the whole active arrangement rescales by `desired / measured` via the
`scaleArrangement` store action. This reuses the *already-solved* "which
fields are real-world lengths vs. ratios/counts/angles/enums" problem from
`lib/geometry/patternScale.ts` (`scaleShapePrimitive`, `scalePatternForShape`,
`scaleCenterHole`) plus a new `scaleGenerator` in `instanceTransform.ts`.
**Components are shared by id** — scaling one arrangement scales every
component it uses everywhere else those components are also reused, same
as any other component edit.

## Explicitly deferred (not built, but reference-image-motivated)

The product direction here was set by ~20 reference photos of real festival
stage/sculpture builds (radial mandala flowers, geodesic hex/triangle
domes, tessellated star facades, totems on poles, asymmetric bolted
compound "creature" shapes). Still missing, roughly in likely-next order:

- **Nested sub-assemblies** — an Assembly reused as a building block inside
  a bigger one (needed for "ring of dome-tiles" or "crown of petal-
  clusters"). Biggest remaining architectural gap.
- **Path/curve generator** — place instances along a bezier/curve (for a
  garland/chain, like the suspended-dragon reference photo).
- Extruded 3D fin/connector-tab solids (fins currently only render as flat
  2D outlines in the "Flat layers" view — never extruded in the 3D
  preview).
- Per-tile-varying grid tilt (a true faceted dome from the Grid generator,
  vs. today's uniform tilt across all tiles).
- `InstancedMesh` GPU instancing (fine at today's typical instance counts;
  revisit if arrangements grow into the hundreds).
- Per-material appearance/color in the 3D preview (currently one shared
  neutral tan look, ignoring `material.label`).
- Vertex-snapping when picking calibrate-scale points (currently raw
  raycast hit point on whatever face you click).

## Rating/insights feature (built earlier, unrelated to the above)

`src/store/ratingsStore.ts` + `src/lib/insights.ts` +
`RatingPanel.tsx`/`InsightsPanel.tsx` — in Debug mode, rate the current
design "good"/"ok", snapshotting its full params. The Insights panel
aggregates observed min/max/avg per numeric param split by rating, and
pattern-kind frequency among "good" designs — meant to be read by a human
(or fed back to Claude) to decide things like "this range is never used
above 60%, narrow the slider," not to auto-generate suggestions itself.

## Gotchas

- **`npx tsc --noEmit` alone checks NOTHING in this project** — it's a
  project-references root config with `files: []`. Always run
  `npx tsc --noEmit -p tsconfig.app.json`. This bit me once this session;
  don't repeat it.
- Bumping the persisted store schema (`designerStore.ts`'s `persist`
  `version`) requires a matching backfill step in
  `lib/migration/backfillProject.ts` — it's versionless/idempotent by
  design (every step uses `??`, safe to run unconditionally on data from
  ANY source), so add a step there rather than branching on version number.
- `patterns/stamp.ts` reuses `computeInstanceTransforms`/`RadialPlacement`
  (the flat 2D version) for its own in-pattern ring-stamping — don't
  conflate that with `computeRadialTransforms`/`RadialGenerator` (the 3D
  arrangement version); they're deliberately separate so stamp.ts stays a
  pure 2D concept.

## Testing

`npx vitest run` for the full suite (235 tests as of this session). Test
files use local factory functions (`layer(overrides)`, `component(id,
overrides)`, etc.) returning a full valid object with sensible defaults,
spread-overridden per test — follow that convention rather than
constructing fixtures inline.
