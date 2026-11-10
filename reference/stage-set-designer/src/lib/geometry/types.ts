export interface Point {
  x: number
  y: number
}

// Implicitly closed (no repeated last point), orientation normalized on entry to clipper.ts.
export type Polygon = Point[]

/** An anchor point on a freeform shape, plus its own "pull handle" as an
 * (hx, hy) OFFSET from the anchor — not an absolute position, so moving
 * the anchor carries the handle with it for free. */
export interface FreeformPoint extends Point {
  hx: number
  hy: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type PatternKind =
  | 'voronoi'
  | 'hexagon'
  | 'stamp'
  | 'vein'
  | 'flow'
  | 'circuit'
  | 'manta'
  | 'scales'
  | 'rungs'
  | 'maze'
  | 'sierpinski'
  | 'truchet'
  | 'zebra'
  | 'stagger'
  | 'marble'
  | 'vesica'
  | 'phyllo'
  | 'rings'
  | 'hilbert'
  | 'life'
export type PatternMode = 'cut' | 'etch'
export type CornerStyle = 'round' | 'miter'
export type HexOrientation = 'pointy' | 'flat'
/** Pathfinder-style combination of overlapping instances within a layer.
 * 'none' = instances stay fully independent (may overlap, as before). */
export type BooleanMode = 'none' | 'union' | 'subtract' | 'intersect' | 'exclude'

export type ShapePrimitive =
  | { kind: 'rect'; width: number; height: number; cornerRadius: number }
  | { kind: 'regularPolygon'; sides: number; radius: number; rotation: number; cornerRadius: number }
  | { kind: 'superellipse'; width: number; height: number; exponent: number }
  | { kind: 'blob'; radius: number; complexity: number; irregularity: number; seed: number }
  | { kind: 'star'; points: number; radius: number; innerRadiusRatio: number; rotation: number; cornerRadius: number }
  | { kind: 'teardrop'; radius: number; pointSharpness: number; rotation: number }
  | { kind: 'diamond'; width: number; height: number; cornerRadius: number }
  | { kind: 'eye'; width: number; height: number; rotation: number }
  /** Archimedean-ish spiral, stroked into a ribbon — covers both a tight
   * multi-turn "swirl" (high `turns`) and a short hooked "swoosh" (low
   * `turns`). The ribbon automatically tapers to a point wherever its half
   * width would exceed the local radius (most simply, near the center when
   * `startRadius` is small), so no separate taper flag is needed. */
  | { kind: 'spiral'; turns: number; startRadius: number; endRadius: number; strokeWidth: number; rotation: number }
  /** A sinusoidal ribbon that tapers to a point at both ends — `leafBulge`
   * adds width bulges at each wave peak/trough for a leaf-vine look; 0
   * gives a plain flowing ribbon ("swoosh"/"flowing thing"). */
  | {
      kind: 'vine'
      length: number
      amplitude: number
      waveCount: number
      strokeWidth: number
      leafBulge: number
      rotation: number
    }
  /** A spine-and-width-profile leaf silhouette: a straight or gently bent
   * centerline (`curvature` degrees of total bend from base to tip) with a
   * single-peak width profile — 0 at the base, `maxWidth` at
   * `widthPosition` (0..1 along the length), back to 0 at the tip.
   * `baseTaper`/`tipTaper` are exponents (1 = linear, >1 = rounds off
   * gently, <1 = draws to a sharper point) applied independently either
   * side of the peak. */
  | {
      kind: 'leaf'
      length: number
      maxWidth: number
      widthPosition: number
      baseTaper: number
      tipTaper: number
      curvature: number
      rotation: number
    }
  /** A hand-sculpted outline: a closed loop of anchor points, each with its
   * own draggable "pull handle" (hx, hy — an offset from the anchor, not
   * an absolute position) controlling the cubic-bezier tangent through it.
   * The incoming tangent is the handle mirrored through its anchor, so
   * every anchor stays smooth by construction — the same "smooth point"
   * convention most vector editors default to. The one shape kind edited
   * directly on the canvas instead of through sliders. */
  | { kind: 'freeform'; points: FreeformPoint[] }
  /** A compound shape, unlike every other kind here: a tapered spine
   * ribbon with `barbCount` pairs of swept, tapering barbs unioned onto
   * it — built from multiple sub-shapes boolean-combined into one
   * outline, rather than a single closed-form curve. */
  | {
      kind: 'feather'
      length: number
      spineWidth: number
      barbCount: number
      barbLength: number
      barbWidth: number
      barbSweep: number
      rotation: number
    }

export interface RecursionConfig {
  depth: number
  childScale: number
  strutFalloff: number
  minCellArea: number
  maxLeafCells: number
}

export interface RadialModulationConfig {
  enabled: boolean
  sizeStart: number // scale factor at the pattern's center
  sizeEnd: number // scale factor at the pattern's max radius
  orientToCenter: boolean // rotate each cell to face outward from the pattern center
  swirlAmount: number // degrees of progressive twist at max radius
  pinchAmount: number // -1..1, field-level radial remap (center expands/compresses)
  stretchAmount: number // -1..1, per-cell anisotropic scale along its own radial direction
}

/** Random, non-radial per-cell variation — independent of both `cellSize`
 * (the nominal/average size) and `jitter` (which only perturbs each
 * generator's own site/seed positions before the cells are built, so its
 * effect on distance-between-cells varies by pattern kind). Dispersion is
 * applied uniformly to whatever cells came out, regardless of kind: each
 * cell gets its own random scale (size variance) and its own random
 * nudge away from its generated position (distance variance), so cells
 * end up genuinely uneven in both size and spacing rather than a single
 * jittered-but-still-regular lattice. */
export interface DispersionConfig {
  enabled: boolean
  sizeVariance: number // 0..1 — each cell scaled by 1 ± this, around its own centroid
  distanceVariance: number // 0..1 — each cell nudged by up to this × cellSize, in a random direction
}

export interface StampConfig {
  shape: ShapePrimitive // the motif to repeat — reuses the exact shape system
  ringSpacing: number // mm between concentric rings; 0 means "use cellSize"
  autoOrient: boolean // rotate each stamp to face outward from the pattern center
  ringStagger: number // degrees to offset alternating rings, for an interlocking look
}

/** A second, independent pattern generated across the same outline as the
 * main pattern, always as etch-only decorative detail — e.g. a fine
 * PCB-trace-like lattice engraved on top of a coarse structural cut
 * lattice. Deliberately excludes `mode`/`nullShape`/`explodeAmount`/
 * `keepAllLevelsInCut`/`surfaceDetail` from the full PatternConfig: those
 * concerns belong to the outer, structural pattern, and a detail layer
 * can't itself carry another nested detail layer. */
export type SurfaceDetailPatternConfig = Omit<
  PatternConfig,
  'mode' | 'nullShape' | 'explodeAmount' | 'keepAllLevelsInCut' | 'surfaceDetail' | 'edgeDetail'
>

export interface SurfaceDetailConfig {
  enabled: boolean
  pattern: SurfaceDetailPatternConfig
}

/** A decorative motif repeated along a boundary — either the component's
 * own outer edge or a center hole's rim. Reuses none of the fractal cell
 * machinery: this walks the boundary at even arc-length steps and stamps
 * (or bands) a small motif at each, independent of the main lattice. */
export type EdgeDetailKind = 'dots' | 'ticks' | 'dashes' | 'wave' | 'zigzag'

export interface EdgeDetailConfig {
  enabled: boolean
  kind: EdgeDetailKind
  mode: PatternMode
  /** mm — distance between repeats for a discrete motif (dots/ticks/
   * dashes), or the wavelength for a continuous band (wave/zigzag). */
  spacing: number
  /** mm — motif diameter/length, or band depth for wave/zigzag. */
  size: number
  /** mm — gap left between the boundary itself and where the motif starts. */
  offset: number
}

export interface PatternConfig {
  kind: PatternKind
  mode: PatternMode
  cellSize: number
  jitter: number
  seed: number
  /** True rotational symmetry: the pattern is generated in a single
   * 360/N wedge around the shape's center, then rotate-copied N times.
   * 1 = no symmetry (generate across the whole shape, as before). */
  symmetryCount: number
  /** Dihedral (kaleidoscope) symmetry, on top of `symmetryCount`'s
   * rotation: generation happens in a HALF wedge (180/N), which is then
   * mirrored across its own far edge to complete one bilaterally-symmetric
   * full wedge before that gets rotate-copied N times — so each wedge is
   * a mirror image of itself, not just a spun copy. No effect when
   * symmetryCount is 1 (there's no wedge to mirror). */
  mirrorSymmetry: boolean
  /** Which axis (or both) the standalone bilateral reflection runs across
   * when symmetryCount is 1 — i.e. mirrorSymmetry with no rotational
   * copies. Both together give 4-fold (quadrant) symmetry: generation is
   * restricted to one quadrant, then reflected across the horizontal axis,
   * then across the vertical axis, covering all four. Ignored once
   * symmetryCount > 1: there, the mirror axis is implicitly each wedge's
   * own edge. */
  mirrorHorizontal: boolean
  mirrorVertical: boolean
  hexOrientation: HexOrientation
  edgeMargin: number
  strutWidth: number
  minStrutWidth: number
  kerf: number
  cornerStyle: CornerStyle
  recursion: RecursionConfig
  trimSlivers: boolean
  sliverAreaRatio: number
  keepAllLevelsInCut: boolean
  radialModulation: RadialModulationConfig
  dispersion: DispersionConfig
  stamp: StampConfig
  /** "Null" the shape: the designed outline stops being a hard boundary or
   * a border to cut. It's still used to decide WHICH cells to generate
   * (a container), but the exported outline becomes the union of the
   * leaf cells themselves — an organic silhouette that hugs the pattern —
   * with no separate cut-holes layer (there's no panel to cut them into). */
  nullShape: boolean
  /** mm — only applies when nullShape is on. Pushes each leaf cell further
   * outward from the pattern center, on top of the strut-width gap, so
   * pieces can be visibly separated rather than just barely not touching. */
  explodeAmount: number
  /** A second, independent etch-only pattern generated across the same
   * outline — e.g. fine decorative trace-work over a coarse structural cut
   * lattice. Also works when nullShape is on: each detail fragment is
   * clipped to whichever leaf cell it originally fell within, then carried
   * along by that leaf's own explode offset, so the decoration stays
   * registered to its piece as Explode amount pushes it outward. */
  surfaceDetail: SurfaceDetailConfig
  /** A decorative motif banded around the component's own outer edge —
   * independent of the main lattice, skipped when nullShape is on (there's
   * no continuous panel boundary left to decorate). */
  edgeDetail: EdgeDetailConfig
}

/** A single placed copy of a component within an Arrangement layer, in full
 * 3D — unlike `InstanceTransform` (instanceTransform.ts), which is the flat
 * 2D transform the cut-geometry pipeline actually consumes. Each
 * component's own pattern is a flat cut sheet, so only x/y/rotationZ/
 * mirrored ever reach that 2D pipeline (see `projectToPlane`); z and
 * rotationX/rotationY describe how that flat sheet sits in space, consumed
 * by the 3D preview (Arrangement3DView) instead. Rotation composition
 * order, matched by that preview's Euler 'ZXY' order: rotationZ (facing)
 * first, then rotationX (tilt), then rotationY (swivel), each an
 * intrinsic/local-axis rotation, applied before translating to (x, y, z). */
export interface Instance3D {
  x: number
  y: number
  z: number
  rotationX: number
  rotationY: number
  rotationZ: number
  mirrored: boolean
}

/** Today's radial array, extended with real 3D placement: `axis` picks
 * which plane the ring itself lies in (`'z'` = flat/top-down, today's only
 * behavior; `'x'`/`'y'` stand the ring up vertical — a totem or crown ring
 * rather than a flat wheel). `tiltDeg` cants every instance outward/inward
 * around its own facing direction (stored as `rotationX`), and `swivelDeg`
 * leans it sideways around a second, independent axis (stored as
 * `rotationY`) — e.g. petals canted out from a dome (tilt) that also lean
 * left/right around the ring (swivel), rather than a single tilt axis. */
export interface RadialGenerator {
  kind: 'radial'
  count: number
  radius: number
  startAngle: number
  arcSpan: number
  autoOrient: boolean
  instanceRotation: number
  alternateMirror: boolean
  tiltDeg: number
  swivelDeg: number
  axis: 'z' | 'x' | 'y'
}

/** A flat rows×cols tiling — for a tessellated facade rather than a ring.
 * `staggerOffset` shifts every other row along X, for a brick/honeycomb-
 * style offset instead of a plain grid. `tiltDeg`/`swivelDeg` cant every
 * tile the same amount on two independent axes (stored as rotationX/
 * rotationY on each instance) — enough to angle a whole facade section,
 * though not (yet) a per-tile curvature across the grid. */
export interface GridGenerator {
  kind: 'grid'
  rows: number
  cols: number
  spacingX: number
  spacingY: number
  staggerOffset: number
  tiltDeg: number
  swivelDeg: number
}

/** No formula — each instance authored/edited directly, for a one-off
 * asymmetric compound build (e.g. a bolted-together creature shape) that
 * doesn't fit a repeat pattern. */
export interface ManualGenerator {
  kind: 'manual'
  instances: Instance3D[]
}

export type PlacementGenerator = RadialGenerator | GridGenerator | ManualGenerator

export type WarningCode =
  | 'budget-truncated'
  | 'strut-below-minimum'
  | 'no-cells-generated'
  | 'edge-margin-too-small'

export interface GeometryWarning {
  code: WarningCode
  message: string
  count?: number
}

export interface GeometryStats {
  leafCells: number
  totalCells: number
  maxLevelReached: number
  minStrutUsed: number
  cutAreaMm2: number
  materialAreaMm2: number
  computeMs: number
  truncated: boolean
}

export interface GeometryResult {
  /** Normally a single simple polygon (the designed shape). When
   * `PatternConfig.nullShape` is on, this becomes the union of the leaf
   * cells — possibly several disjoint pieces, and possibly extending
   * beyond the original designed shape (e.g. when exploded). */
  outline: Polygon[]
  patternBoundary: Polygon
  cutPaths: Polygon[]
  etchPaths: Polygon[]
  /** The surface-detail sub-pattern's own etch geometry, kept separate from
   * `etchPaths` (the main pattern's) so they can render/export as visually
   * distinct layers — decorative detail vs. the primary structure. */
  detailEtchPaths: Polygon[]
  bounds: Bounds
  stats: GeometryStats
  warnings: GeometryWarning[]
}
