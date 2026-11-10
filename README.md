# Orbis — circular circuit generator

Parametric generator for concentric "circuit ring" designs: banded rings sliced into parts, with stepped notches, bubble cutouts, via rows and hairline traces. Built to be made: laser cutting, CNC routing, 3D printing and pen plotting.

No build step, no dependencies.

```sh
npm start        # → http://localhost:5173
npm test         # geometry + export tests (node --test)
```

## Stage mode

The **Stage** workspace turns the disc into the centrepiece of a festival stage facade, drawn as a to-scale front elevation.

- **Everything is a flat panel placed in 3D.** Each part keeps its flat cut shape plus a position, so panels can stand off the back plane, step forward or back, or tilt into folded forms. Drag the view to orbit.
- **Source pieces**: the cell, petal, spike and core each have a tab with a large preview and a gallery of every option drawn on that piece, so you can see what a choice does before picking it. Petals, spikes and the core can follow the cell or carry their own module and fretwork. Petal shapes: leaf, eye, teardrop, diamond, blade.
- **Etch detail**: a score-only layer (outline, voronoi, hatch, grid or rings) clipped against every cutout so nothing is engraved across an opening; exported on the engrave layer.
- **Tendrils**: flowing horns, vines and feathers. A curved spine is cut into short convex segments, so the curve is still made of flat sheet parts; vines grow leaves and feathers grow barbs.
- **Mandala core**: a dihedral design, where one half-wedge is generated, mirrored, then repeated around the centre.
- **Freeform petal**: drag five handles to shape the petal; it is kept convex automatically.
- **Layers**: drag to reorder spikes, tendrils, lattice, petals and core (order sets stand-off), or hide any of them.
- **Scale together**: resizing the stage width rescales every size in proportion, while sheet, bit and thickness stay fixed.
- **Hide controls**: switch it on to put an eye on every slider and hide the ones you never use.
- **View**: drag to orbit, scroll or pinch to zoom, Shift-drag to pan.
- **Modules**: *Stepped* (nested frames stepping forward, or back for a portal look), *Folded* (each cell becomes a pyramid of tilted faces, cut at true size), *Scales* (panels hinged up from their inner edge like shingles), or *Flat* with raised islands.
- **Fretwork**: window (frame for diffuser), nested slots, fan, slat fan, louvre, halftone perforation, or a mix by ring. A minimum web is always kept. *Backlit* lights every cutout.
- **Layout**: *Radial* wraps the lattice round the core (cells grow outward); *Grid* is a regular wall of identical modules. Cells too big for a sheet split into matching sets (a hexagon becomes a centre and six surrounds), and stray modules or cut-off clumps at the edge are dropped.
- **Randomise** rolls a whole family of stage (hex wall, crystal field, diamond temple, sun gate, mandala shield, petal eye, feather fan, portal arch) and varies it within limits that hold together — see `src/stagerandom.js`. Presets marked *(ref)* recreate reference stages.
- **Depth and bands**: the lattice sits on a form (funnel, cone, dome, barrel, ripple) up to 8 m deep, and is divided into concentric *Bands* that step in depth and alternate module. Far panels dim in the front view so depth reads straight on. The DJ booth front is switched off for now.
- **Organic parts** (`src/ribbon.js`): horns, flames, feathers, vines, curled petals and flame spikes are *ribbons* — a spine curve with a width either side — so their outlines are truly curved, in single pieces split only where a sheet runs out. Cutouts follow the curve: feather vein, flowing slots, ribs, eyes or a frame. *Spikes on crown* rides them along the crown edge.
- **Banded radial lattice**: the radial lattice is built in concentric bands that add cells as the radius grows, so modules stay a similar size instead of ballooning at the edge.
- **Stack nesting**: a stepped module's frames are cut from each other's window offcuts (innermost first, the window after), so a whole stack takes the sheet space of its outer frame. The default stage drops from 69 sheets to 55.
- **Pick a stage**: Randomise opens a sheet of eight rolls to choose from, optionally limited to one family.
- **Fixing holes**: set a hole diameter under Make to add bolt holes in the solid rim of back-plane panels and at the ends of curved parts; they are counted in the bill of materials and the setting-out list.
- **Lights**: plays a chase outward from the centre in the night view.
- **Pattern library** (`src/patterns.js`): voronoi, honeycomb, crackle, Sierpinski, truchet, diamonds, bricks, maze, pixels (Game of Life), waves, ring slots, bloom, lens weave, fish scales and sunflower. Each works as cut-through fretwork (every opening convex and a full web apart) and as etch detail.
- **Cores**: your Disc design as a layered medallion, Iris (radial segments), Star, Rosette (a ring of hexagons round a centre), a Void, or no core at all. *Core Gap* opens a clear ring between the core and everything around it. Side medallions use the same core type.
- **Forms**: Flat, Dome, Barrel, Cone or Ripple, pushed out or in. Panels stay flat: each sits on the surface's tangent plane, and the Folded module turns the surface into true triangular facets.
- **Spikes**: long kites radiating from behind the lattice, for sunbursts and horns.
- **Presets and variations**: ten starting points (Hive Shield, Stargate, Geodesic Pod, Dragon Scales…) and a strip of one-click variations.
- **3D printing**: choose what to print instead of cut (core, petals, spikes, or everything that fits), set the bed size (245 mm by default, up to 2000) and thickness. Parts that fit leave the CNC sheets and export as one STL each.
- **Petal ring**: convex leaf or flame petals fanned around the centre, in up to three stacked layers with an eye.
- **Panel lattice**: Hex, Diamond, Shard or Brick tilings in polar space, a crown silhouette, shadow gaps, edge erosion, and automatic subdivision of any cell too big for a sheet.
- **DJ booth** front, stage deck (2×1 m modules) and an indicative goalpost truss, with 1.75 m figures for scale.
- **Views**: Night (LED-lit), Day (material) and Setting-out (numbered panels on a 1 m grid).
- **Make**: sheet size, thickness, bit and material; panels are nested onto sheets with a bill of materials (sheets, CNC time, weight, LED run, deck modules, facade area).
- **Build kit .zip**: nested cut sheets (SVG + DXF, engraved panel numbers, cutouts before outlines), setting-out drawing and CSV of every panel position and stand-off, visuals, settings and notes.

The facade is a wind sail: structure, fixings and wind limits must be designed and signed off by a qualified engineer. The truss shown is indicative only.

## Features

- **Live parametric controls**: 21 design parameters across Layout, Slices, Notches & Edges, Cutouts and Traces.
- **Deterministic seeds**: each stage draws from its own random sub-stream, so changing bubble size doesn't reshuffle the slice layout.
- **Workshop preview**: parts rendered in the chosen material on a millimetre cutting mat, with a live scale bar. Top, Tilt and Exploded views; Material, Toolpath, Line Work, Solid, Neon and Plot render modes.
- **Variations explorer**, **Randomize / Mutate / New Seed** with per-parameter locks, undo/redo, presets and shareable URLs.

## Making it

The **Make** panel turns the design into something a machine can produce.

- **Process presets**: Laser, CNC, 3D Print and Pen Plot set tool/beam/nozzle size, kerf, bed size, material and the manufacturing limits below.
- **Manufacturing limits are part of the geometry**: *Min hole Ø* and *Min web* are hard constraints. No hole is smaller than the bit, and no web between holes or edges is thinner than the limit.
- **Checks (DFM)**: slice and ring gaps against the tool, thinnest section, knife-edge tips from steep wall angles, CNC inside-corner radii, and bed fit.
- **Estimates**: machine or print time, weight from material density, pierce count and depth passes.
- **Cut layouts**
  - *Assembled*: as designed.
  - *Nested sheets*: parts are rotated and dropped onto a skyline using their real profiles, so arcs spoon into each other. Optional engraved part numbers.
  - *Stencil plate*: one connected disc with the parts cut out as windows.
  - *Backer disc*: a mounting disc with pin holes, engraved part outlines and the traces.
  - *Jig*: a glue-up jig with oversize windows that locates every part on the backer.
- **Fit design to bed**: rescales every length in the design, keeping machine limits fixed.
- **Kerf compensation** (laser): part outlines grow and holes shrink by half the kerf.

## Putting it together

Separate parts are useless if you can't line them up, so every design comes with its own locating system.

- **Locating pins** (default on). Each part gets two pin holes at its roomiest spots, or one on very short parts, never closer than *Min web* to an edge or hole. The Backer disc gets a matching hole under every pin. Push in dowels, skewers or 1.75 mm filament, drop the parts on, and glue. The pin pair is different on every part, so each part fits only one place, one way round.
- **Jig for glue-up** (no pins needed). A disc with every part's outline cut as a window, slightly oversize (0.2 mm default). It shares four unevenly spaced alignment holes with the backer, so it sits only one way. Pin it on, drop the parts in, glue, and lift it off.
- **3D print** prints base, rings and traces fused as one object, so there's nothing to align. The kit also includes the bodies as separate STLs with a shared origin, for multi-colour prints. When printing in pieces, the base has pegs that match the rings' pin holes.
- **Kit .zip** holds every sheet you need (parts, backer and jig as SVG + DXF), or the STL bodies, plus a README with the numbered build steps and the checks.
- Traces sit in the gaps between parts, so on a cutter they're engraved on the backer, not the scrap.

## Exports

| Format | Contents |
| --- | --- |
| SVG | True mm size. Layers in machining order: `1-ENGRAVE` (blue), `2-LABELS` (black, single-stroke digits), `3-CUT-INNER` (magenta: holes, windows, pin holes), `4-CUT-OUTLINE` (red), plus `GUIDES` (sheet outlines; don't cut). Inner cuts have their own colour so they can run before the outlines. |
| DXF | R12 in mm with the same layers. Opens in LightBurn, Fusion, VCarve, Illustrator and LibreCAD. |
| STL | Binary, watertight relief: optional base disc with mounting holes, parts extruded per ring height, raised traces. |
| Kit .zip | Parts, backer and glue jig as SVG + DXF (or STL bodies for print), settings JSON, and a README with build steps and checks. |
| PNG / JSON | 2048 px render; settings you can re-import. |

## Keyboard

`R` randomize · `M` mutate · `N` new seed · `Space` animate · `V` render mode · `C` view · `X` shuffle variations · `Ctrl+Z` / `Ctrl+Shift+Z` undo / redo

## Layout

```
index.html, styles.css   UI shell
src/generator.js         geometry (pure, units = mm)
src/render.js            SVG rendering + palettes
src/export.js            fabrication SVG, DXF, PNG
src/fabrication.js       processes, materials, layouts, nesting, checks, estimates
src/mesh.js              triangulation + STL
src/zip.js               store-only zip writer
src/variations.js        variation mutators
src/presets.js           built-in presets
src/app.js               UI controller
serve.js                 zero-dependency static server
```
