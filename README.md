# Orbis — circular circuit generator

Parametric generator for concentric "circuit ring" designs: banded rings sliced into parts, with stepped notches, bubble cutouts, via rows and hairline traces. Built to be made: laser cutting, CNC routing, 3D printing and pen plotting.

No build step, no dependencies.

```sh
npm start        # → http://localhost:5173
npm test         # geometry + export tests (node --test)
```

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
  - *Nested sheets*: each part is rotated to its tightest bounding box and packed onto bed-sized sheets, with optional engraved part numbers.
  - *Stencil plate*: one connected disc with the parts cut out as windows.
  - *Backer disc*: a mounting disc with pin holes, engraved part outlines and the traces.
  - *Jig*: a glue-up jig with oversize windows that locates every part on the backer.
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
| SVG | True mm size. Layers `CUT` (#ff0000), `ENGRAVE` (#0000ff), `LABELS`, `GUIDES` (sheet outlines; don't cut). Follows the LightBurn / Glowforge colour convention. |
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
