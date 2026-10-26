# Orbis — circular circuit generator

Parametric generator for concentric "circuit ring" designs: banded rings sliced into parts, with stepped notches, bubble cutouts, via rows and hairline traces. Built for laser cutting, pen plotting and print, with a live 3D preview.

No build step, no dependencies.

```sh
npm start        # → http://localhost:5173
npm test         # geometry + export tests (node --test)
```

## Features

- **Live parametric controls** — 21 parameters across Layout, Slices, Notches & Edges, Cutouts and Traces. Drag sliders or type exact values.
- **Deterministic seeds** — every stage draws from its own random sub-stream, so changing bubble size doesn't reshuffle the slice layout.
- **Views** — Top, Tilt and Exploded (rings stacked in 3D). Drag to orbit, scroll to zoom, double-click to reset.
- **Render modes** — Line Work, Solid, Neon, Plot (ink on paper). Six palettes.
- **Animate** — rings counter-rotate at different speeds.
- **Variations explorer** — 12 labelled mutations of the current design (`4 RINGS · SEED 40`, `NOTCH 0.7 · EDGE 4`, …). Click one to adopt it.
- **Randomize / Mutate / New Seed** with per-parameter locks, plus full undo/redo.
- **Presets** — built-ins plus your own saved to the browser.
- **Sharing** — the design lives in the URL hash; *Copy Link* shares the exact design.
- **Fabrication stats** — part and cutout counts, outer Ø, total cut length and material area.

## Exports

| Format | Contents |
| --- | --- |
| SVG · Cut | True mm units. `CUT` layer (red, parts + holes) and `ENGRAVE` layer (blue, traces + pads) as Inkscape layers. |
| DXF | R12, mm, `CUT` / `ENGRAVE` layers — opens in LightBurn, Fusion, Illustrator, LibreCAD. |
| SVG · Art | Styled as shown on screen. |
| PNG | 2048 × 2048. |
| JSON | Parameters; re-load with *Import JSON*. |

## Keyboard

`R` randomize · `M` mutate · `N` new seed · `Space` animate · `V` render mode · `C` view · `X` shuffle variations · `Ctrl+Z` / `Ctrl+Shift+Z` undo / redo

## Layout

```
index.html, styles.css   UI shell
src/generator.js         geometry (pure, units = mm)
src/render.js            SVG rendering + palettes
src/export.js            cut SVG, DXF, PNG
src/variations.js        variation mutators
src/presets.js           built-in presets
src/app.js               UI controller
serve.js                 zero-dependency static server
```
