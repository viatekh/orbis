import type { ShapePrimitive } from '../../types'

/** A handful of named presets per shape kind, spanning the range each
 * parameter can push the shape toward — shown as clickable thumbnails so
 * "what does this slider actually do" has a visual, triable answer instead
 * of a guess. Kept intentionally small (3-4 per kind): enough to show the
 * range, not a full parameter sweep. */
export const SHAPE_PRESETS: Record<ShapePrimitive['kind'], { label: string; shape: ShapePrimitive }[]> = {
  rect: [
    { label: 'Square', shape: { kind: 'rect', width: 200, height: 200, cornerRadius: 0 } },
    { label: 'Sharp rectangle', shape: { kind: 'rect', width: 300, height: 150, cornerRadius: 0 } },
    { label: 'Pill', shape: { kind: 'rect', width: 300, height: 150, cornerRadius: 75 } },
  ],
  regularPolygon: [
    { label: 'Triangle', shape: { kind: 'regularPolygon', sides: 3, radius: 150, rotation: -90, cornerRadius: 0 } },
    { label: 'Hexagon', shape: { kind: 'regularPolygon', sides: 6, radius: 150, rotation: 0, cornerRadius: 0 } },
    { label: 'Circle-ish', shape: { kind: 'regularPolygon', sides: 16, radius: 150, rotation: 0, cornerRadius: 0 } },
    { label: 'Rounded hex', shape: { kind: 'regularPolygon', sides: 6, radius: 150, rotation: 0, cornerRadius: 30 } },
  ],
  superellipse: [
    { label: 'Diamond (low)', shape: { kind: 'superellipse', width: 250, height: 250, exponent: 0.8 } },
    { label: 'Ellipse', shape: { kind: 'superellipse', width: 300, height: 180, exponent: 2 } },
    { label: 'Rounded rect (high)', shape: { kind: 'superellipse', width: 300, height: 180, exponent: 7 } },
  ],
  star: [
    { label: 'Slim 5-point', shape: { kind: 'star', points: 5, radius: 150, innerRadiusRatio: 0.35, rotation: -90, cornerRadius: 0 } },
    { label: 'Fat 6-point', shape: { kind: 'star', points: 6, radius: 150, innerRadiusRatio: 0.7, rotation: -90, cornerRadius: 0 } },
    { label: 'Rounded burst', shape: { kind: 'star', points: 8, radius: 150, innerRadiusRatio: 0.5, rotation: 0, cornerRadius: 15 } },
  ],
  blob: [
    { label: 'Gentle', shape: { kind: 'blob', radius: 150, complexity: 3, irregularity: 0.15, seed: 1 } },
    { label: 'Wild', shape: { kind: 'blob', radius: 150, complexity: 7, irregularity: 0.7, seed: 3 } },
  ],
  teardrop: [
    { label: 'Blunt', shape: { kind: 'teardrop', radius: 150, pointSharpness: 0.5, rotation: -90 } },
    { label: 'Classic', shape: { kind: 'teardrop', radius: 150, pointSharpness: 1.3, rotation: -90 } },
    { label: 'Needle', shape: { kind: 'teardrop', radius: 150, pointSharpness: 2.8, rotation: -90 } },
  ],
  diamond: [
    { label: 'Classic gem', shape: { kind: 'diamond', width: 200, height: 260, cornerRadius: 0 } },
    { label: 'Long lozenge', shape: { kind: 'diamond', width: 100, height: 320, cornerRadius: 0 } },
    { label: 'Rounded', shape: { kind: 'diamond', width: 200, height: 260, cornerRadius: 40 } },
  ],
  eye: [
    { label: 'Narrow almond', shape: { kind: 'eye', width: 320, height: 60, rotation: 0 } },
    { label: 'Wide lens', shape: { kind: 'eye', width: 260, height: 160, rotation: 0 } },
    { label: 'Tall lens', shape: { kind: 'eye', width: 140, height: 260, rotation: 0 } },
  ],
  spiral: [
    { label: 'Swoosh', shape: { kind: 'spiral', turns: 0.4, startRadius: 0, endRadius: 150, strokeWidth: 40, rotation: 0 } },
    { label: 'Tight swirl', shape: { kind: 'spiral', turns: 3, startRadius: 5, endRadius: 150, strokeWidth: 18, rotation: 0 } },
    { label: 'Loose spiral', shape: { kind: 'spiral', turns: 1.5, startRadius: 20, endRadius: 150, strokeWidth: 25, rotation: 0 } },
  ],
  vine: [
    { label: 'Flowing ribbon', shape: { kind: 'vine', length: 300, amplitude: 40, waveCount: 1.5, strokeWidth: 20, leafBulge: 0, rotation: 0 } },
    { label: 'Leafy vine', shape: { kind: 'vine', length: 300, amplitude: 40, waveCount: 2.5, strokeWidth: 18, leafBulge: 1, rotation: 0 } },
    { label: 'Tight wave', shape: { kind: 'vine', length: 300, amplitude: 15, waveCount: 5, strokeWidth: 14, leafBulge: 0.3, rotation: 0 } },
  ],
  leaf: [
    {
      label: 'Classic leaf',
      shape: { kind: 'leaf', length: 320, maxWidth: 160, widthPosition: 0.42, baseTaper: 1.2, tipTaper: 1.6, curvature: 0, rotation: -90 },
    },
    {
      label: 'Slender frond',
      shape: { kind: 'leaf', length: 420, maxWidth: 90, widthPosition: 0.35, baseTaper: 1.4, tipTaper: 2.2, curvature: 25, rotation: -90 },
    },
    {
      label: 'Broad petal',
      shape: { kind: 'leaf', length: 260, maxWidth: 220, widthPosition: 0.55, baseTaper: 0.8, tipTaper: 1, curvature: -15, rotation: -90 },
    },
    {
      label: 'Curled blade',
      shape: { kind: 'leaf', length: 340, maxWidth: 110, widthPosition: 0.3, baseTaper: 1, tipTaper: 3, curvature: 60, rotation: -90 },
    },
  ],
  // No canned presets — a freeform shape's whole point is that you sculpt
  // it by hand on the canvas rather than pick from fixed configurations.
  freeform: [],
  feather: [
    { label: 'Downy', shape: { kind: 'feather', length: 300, spineWidth: 10, barbCount: 18, barbLength: 45, barbWidth: 6, barbSweep: 40, rotation: 0 } },
    { label: 'Flight feather', shape: { kind: 'feather', length: 400, spineWidth: 16, barbCount: 12, barbLength: 80, barbWidth: 12, barbSweep: 25, rotation: 0 } },
    { label: 'Spiky quill', shape: { kind: 'feather', length: 260, spineWidth: 8, barbCount: 8, barbLength: 90, barbWidth: 6, barbSweep: 10, rotation: 0 } },
  ],
}
