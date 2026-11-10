import { DEFAULT_EDGE_DETAIL, DEFAULT_RADIAL_MODULATION, DEFAULT_RECURSION_CONFIG, DEFAULT_STAMP_CONFIG } from './constants'
import type { PatternConfig, PatternKind, SurfaceDetailPatternConfig } from './types'

export interface PatternPreset {
  label: string
  kind: PatternKind
  /** Only the "look-defining" fields a preset cares about — everything
   * else (fabrication settings like strut width, kerf, edge margin) is
   * left as whatever the component already had, so applying a preset
   * never silently changes something machine-critical. */
  overrides?: Partial<Omit<PatternConfig, 'kind'>>
}

function radial(overrides: Partial<typeof DEFAULT_RADIAL_MODULATION>) {
  return { ...DEFAULT_RADIAL_MODULATION, enabled: true, ...overrides }
}

/** Named, tuned configurations built entirely from the real pattern kinds
 * above — not 50 separate bespoke algorithms, the same relationship the
 * Shape panel's preset gallery has to the shape system. Several requested
 * names (the "Zebra Cross" family, "Circuit Ring"/"Circuit Altar", the
 * stamp-based "Glyph"/"Totem"/"Ornament"/"Medallion" set, etc.) are
 * genuinely close variations of one underlying generator in the original
 * tool too, just with different parameters. */
export const PATTERN_PRESETS: PatternPreset[] = [
  { label: 'Veinflow', kind: 'vein', overrides: { jitter: 0.75, cellSize: 18 } },
  { label: 'Eddy', kind: 'marble', overrides: { radialModulation: radial({ swirlAmount: 60 }) } },
  { label: 'Braids', kind: 'zebra', overrides: { jitter: 0.3, cellSize: 12 } },
  { label: 'Delta', kind: 'vein', overrides: { jitter: 0.3 } },
  { label: 'Reverse', kind: 'hexagon', overrides: { mode: 'etch' } },

  { label: 'Stagger', kind: 'stagger' },
  { label: 'Sierpinski', kind: 'sierpinski' },
  { label: 'Maze', kind: 'maze' },
  { label: 'Labyrinth', kind: 'maze', overrides: { jitter: 0.9, cellSize: 14 } },
  { label: 'Gridmaze', kind: 'maze', overrides: { cellSize: 15, jitter: 0.1 } },
  { label: 'Shipibo', kind: 'circuit', overrides: { symmetryCount: 4, mirrorSymmetry: true, jitter: 0.7 } },
  {
    label: 'Hextech',
    kind: 'hexagon',
    overrides: { recursion: { ...DEFAULT_RECURSION_CONFIG, depth: 1, childScale: 0.45 } },
  },
  { label: 'Biomech', kind: 'vein', overrides: { jitter: 0.9, cellSize: 14 } },
  { label: 'Matrix', kind: 'circuit', overrides: { jitter: 0.15, cellSize: 16 } },
  { label: 'Vesica', kind: 'vesica' },
  { label: 'Tides', kind: 'flow', overrides: { jitter: 0.85, cellSize: 30 } },
  { label: 'Petals', kind: 'manta', overrides: { symmetryCount: 8, mirrorSymmetry: true, jitter: 0.6 } },
  { label: 'Strata', kind: 'rungs', overrides: { cellSize: 35 } },
  { label: 'Gates', kind: 'rungs', overrides: { jitter: 0, cellSize: 20 } },
  { label: 'Rings', kind: 'rings' },
  { label: 'Glyph', kind: 'stamp', overrides: { stamp: { ...DEFAULT_STAMP_CONFIG, ringStagger: 30 } } },
  {
    label: 'Totem',
    kind: 'stamp',
    overrides: { stamp: { ...DEFAULT_STAMP_CONFIG, ringSpacing: 50, autoOrient: true } },
  },
  {
    label: 'Ornament',
    kind: 'stamp',
    overrides: { stamp: { ...DEFAULT_STAMP_CONFIG, ringStagger: 45 }, symmetryCount: 6 },
  },
  { label: 'Roots', kind: 'vein', overrides: { jitter: 0.5 } },
  { label: 'Hilbert', kind: 'hilbert' },
  { label: 'Truchet', kind: 'truchet' },
  {
    label: 'Medallion',
    kind: 'stamp',
    overrides: { stamp: { ...DEFAULT_STAMP_CONFIG, ringSpacing: 200 }, symmetryCount: 1 },
  },
  { label: 'Turing', kind: 'marble', overrides: { jitter: 0.4, cellSize: 20 } },
  { label: 'Currents', kind: 'flow' },
  { label: 'Marble', kind: 'marble' },
  { label: 'Lotus', kind: 'manta', overrides: { symmetryCount: 8, mirrorSymmetry: true, jitter: 0.3 } },
  { label: 'Packing', kind: 'vesica', overrides: { cellSize: 16, jitter: 0.3 } },
  { label: 'Hyperbolic', kind: 'rings', overrides: { radialModulation: radial({ pinchAmount: -0.6 }) } },
  { label: 'Phyllo', kind: 'phyllo' },
  { label: 'Penrose', kind: 'truchet', overrides: { cellSize: 35, jitter: 0.5 } },
  { label: 'Life', kind: 'life' },
  { label: 'Spiral', kind: 'flow', overrides: { jitter: 0.9, radialModulation: radial({ swirlAmount: 90 }) } },
  { label: 'Circuit Altar', kind: 'circuit', overrides: { symmetryCount: 4, mirrorSymmetry: true } },
  { label: 'Opflow', kind: 'flow', overrides: { jitter: 0.95 } },
  {
    label: 'Keyspin',
    kind: 'stamp',
    overrides: {
      stamp: { ...DEFAULT_STAMP_CONFIG, ringStagger: 60, autoOrient: true },
      radialModulation: radial({ swirlAmount: 40 }),
    },
  },
  { label: 'Kaleido', kind: 'hexagon', overrides: { symmetryCount: 12, mirrorSymmetry: true } },
  { label: 'Dazzle', kind: 'zebra', overrides: { jitter: 0.9 } },
  { label: 'Zebra', kind: 'zebra' },
  { label: 'Zebra Cross', kind: 'zebra', overrides: { cellSize: 14, jitter: 0.2 } },
  { label: 'Zebra Cross Open', kind: 'zebra', overrides: { cellSize: 32, jitter: 0.1 } },
  { label: 'Zebra Cross 2', kind: 'zebra', overrides: { cellSize: 20, jitter: 0.5 } },
  { label: 'Zebra Arp', kind: 'zebra', overrides: { cellSize: 12, jitter: 0.7 } },
  { label: 'Sections', kind: 'rungs', overrides: { cellSize: 40 } },
  { label: 'Plume', kind: 'manta', overrides: { jitter: 0.6 } },
  { label: 'Circuit Ring', kind: 'circuit', overrides: { symmetryCount: 8 } },
  { label: 'Vellum Coral', kind: 'marble', overrides: { jitter: 0.9, cellSize: 10 } },
  { label: 'Votive Circuit', kind: 'circuit', overrides: { symmetryCount: 6, mirrorSymmetry: true } },
  { label: 'Wing Feather', kind: 'manta', overrides: { jitter: 0.4 } },
  { label: 'Side-Leaf Curl', kind: 'manta', overrides: { jitter: 0.8, cellSize: 16 } },
]

export function applyPatternPreset(current: PatternConfig, preset: PatternPreset): PatternConfig {
  return { ...current, ...preset.overrides, kind: preset.kind }
}

/** Same presets, applied to a surface-detail pattern instead — which is a
 * strict subset of PatternConfig's fields (no mode/nullShape/explodeAmount/
 * keepAllLevelsInCut/surfaceDetail, since detail is always etch-only and
 * can't itself nest another detail layer). Pads in placeholders to reuse
 * applyPatternPreset's merge logic, then strips them back off — the same
 * trick randomizeSurfaceDetailPattern uses. */
export function applyPatternPresetToSurfaceDetail(
  current: SurfaceDetailPatternConfig,
  preset: PatternPreset,
): SurfaceDetailPatternConfig {
  const asFullPattern: PatternConfig = {
    ...current,
    mode: 'etch',
    nullShape: false,
    explodeAmount: 0,
    keepAllLevelsInCut: false,
    surfaceDetail: { enabled: false, pattern: current },
    edgeDetail: { ...DEFAULT_EDGE_DETAIL },
  }
  const applied = applyPatternPreset(asFullPattern, preset)
  const {
    mode: _mode,
    nullShape: _nullShape,
    explodeAmount: _explodeAmount,
    keepAllLevelsInCut: _keepAllLevelsInCut,
    surfaceDetail: _surfaceDetail,
    edgeDetail: _edgeDetail,
    ...rest
  } = applied
  return rest
}
