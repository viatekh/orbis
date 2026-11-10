import { autoHandle, defaultFreeformPoints, defaultShapeFor, SHAPE_OPTIONS } from './shapeDefaults'
import { KIND_ORDER as PATTERN_KIND_ORDER } from './PatternKindPicker'
import { DEFAULT_EDGE_DETAIL } from '../../lib/geometry/constants'
import type { PatternConfig, Point, ShapePrimitive, SurfaceDetailPatternConfig } from '../../types'

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randomInt(min: number, max: number): number {
  return Math.round(randomBetween(min, max))
}

function randomStep(min: number, max: number, decimals: number): number {
  return Number(randomBetween(min, max).toFixed(decimals))
}

function randomChoice<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)]
}

/** Re-rolls a shape's own numeric fields within the same ranges its sliders
 * allow — keeps the shape KIND stable so this reads as "a variation," not
 * a totally different shape. */
export function randomizeShape(shape: ShapePrimitive): ShapePrimitive {
  switch (shape.kind) {
    case 'rect': {
      const width = randomInt(80, 500)
      const height = randomInt(80, 500)
      return { kind: 'rect', width, height, cornerRadius: randomInt(0, Math.floor(Math.min(width, height) / 4)) }
    }
    case 'regularPolygon': {
      const radius = randomInt(60, 300)
      return {
        kind: 'regularPolygon',
        sides: randomInt(3, 12),
        radius,
        rotation: randomInt(0, 360),
        cornerRadius: randomInt(0, Math.floor(radius * 0.25)),
      }
    }
    case 'superellipse': {
      return {
        kind: 'superellipse',
        width: randomInt(100, 500),
        height: randomInt(100, 500),
        exponent: randomStep(0.6, 8, 1),
      }
    }
    case 'star': {
      const radius = randomInt(60, 300)
      return {
        kind: 'star',
        points: randomInt(3, 12),
        radius,
        innerRadiusRatio: randomStep(0.2, 0.8, 2),
        rotation: randomInt(0, 360),
        cornerRadius: randomInt(0, Math.floor(radius * 0.12)),
      }
    }
    case 'blob': {
      return {
        kind: 'blob',
        radius: randomInt(60, 300),
        complexity: randomInt(2, 8),
        irregularity: randomStep(0.1, 0.7, 2),
        seed: randomInt(0, 9999),
      }
    }
    case 'teardrop': {
      return {
        kind: 'teardrop',
        radius: randomInt(60, 300),
        pointSharpness: randomStep(0.6, 2.5, 2),
        rotation: randomInt(0, 360),
      }
    }
    case 'diamond': {
      const width = randomInt(80, 300)
      const height = randomInt(80, 400)
      return { kind: 'diamond', width, height, cornerRadius: randomInt(0, Math.floor(Math.min(width, height) / 6)) }
    }
    case 'eye': {
      return { kind: 'eye', width: randomInt(150, 400), height: randomInt(60, 250), rotation: randomInt(0, 360) }
    }
    case 'spiral': {
      const endRadius = randomInt(100, 300)
      return {
        kind: 'spiral',
        turns: randomStep(0.3, 3.5, 2),
        startRadius: randomInt(0, 30),
        endRadius,
        strokeWidth: randomInt(10, Math.floor(endRadius * 0.4)),
        rotation: randomInt(0, 360),
      }
    }
    case 'vine': {
      return {
        kind: 'vine',
        length: randomInt(150, 450),
        amplitude: randomInt(20, 90),
        waveCount: randomStep(1, 4, 1),
        strokeWidth: randomInt(10, 40),
        leafBulge: randomStep(0, 1, 2),
        rotation: randomInt(0, 360),
      }
    }
    case 'leaf': {
      return {
        kind: 'leaf',
        length: randomInt(150, 450),
        maxWidth: randomInt(60, 260),
        widthPosition: randomStep(0.2, 0.7, 2),
        baseTaper: randomStep(0.5, 2.2, 1),
        tipTaper: randomStep(0.5, 2.8, 1),
        curvature: randomInt(-60, 60),
        rotation: randomInt(0, 360),
      }
    }
    case 'freeform': {
      // Re-jitters each point's own radius/angle rather than replacing the
      // set outright — keeps the point COUNT (and roughly the silhouette
      // you already sculpted) stable, since "randomize" on a hand-shaped
      // outline should read as "rough it up a little," not "throw away my
      // edit and give me a stranger's shape."
      const base = shape.points.length >= 3 ? shape.points : defaultFreeformPoints()
      const positions: Point[] = base.map((p) => {
        const r = Math.hypot(p.x, p.y) || 150
        const a = Math.atan2(p.y, p.x)
        const rJ = r * randomStep(0.75, 1.3, 2)
        const aJ = a + (Math.random() - 0.5) * 0.3
        return { x: rJ * Math.cos(aJ), y: rJ * Math.sin(aJ) }
      })
      const points = positions.map((p, i) => ({ ...p, ...autoHandle(positions, i) }))
      return { kind: 'freeform', points }
    }
    case 'feather': {
      return {
        kind: 'feather',
        length: randomInt(150, 450),
        spineWidth: randomInt(6, 24),
        barbCount: randomInt(6, 24),
        barbLength: randomInt(30, 110),
        barbWidth: randomInt(4, 18),
        barbSweep: randomInt(0, 60),
        rotation: randomInt(0, 360),
      }
    }
  }
}

/** Unlike `randomizeShape`, this also picks a new KIND at random — meant
 * for "Randomize all," which is explicitly a "surprise me" action, not a
 * variation on what's already there. Reuses `randomizeShape` for the
 * actual parameter rolling once the kind is decided, rather than
 * duplicating every per-kind range here too. */
export function randomizeShapeFully(): ShapePrimitive {
  const kind = randomChoice(SHAPE_OPTIONS).value
  return randomizeShape(defaultShapeFor(kind))
}

/** Re-rolls pattern parameters within their existing slider ranges,
 * keeping pattern KIND stable. Only touches radial-modulation values when
 * that section is already enabled, and only re-randomizes the stamp motif
 * shape when the pattern kind is 'stamp'. */
export function randomizePattern(pattern: PatternConfig): PatternConfig {
  const next: PatternConfig = {
    ...pattern,
    cellSize: randomInt(8, 40),
    jitter: randomStep(0.2, 1, 2),
    seed: randomInt(0, 9999),
    strutWidth: randomStep(Math.max(1, pattern.minStrutWidth), 8, 1),
    edgeMargin: randomInt(2, 25),
    recursion: {
      ...pattern.recursion,
      depth: randomInt(0, 2),
      childScale: randomStep(0.25, 0.55, 2),
      strutFalloff: randomStep(0.4, 0.9, 2),
    },
  }

  if (pattern.radialModulation.enabled) {
    next.radialModulation = {
      ...pattern.radialModulation,
      sizeStart: randomStep(0.6, 1.6, 2),
      sizeEnd: randomStep(0.3, 1.2, 2),
      swirlAmount: randomInt(-90, 90),
      pinchAmount: randomStep(-0.5, 0.5, 2),
      stretchAmount: randomStep(-0.5, 0.5, 2),
    }
  }

  if (pattern.kind === 'stamp') {
    next.stamp = {
      ...pattern.stamp,
      shape: randomizeShape(pattern.stamp.shape),
      ringStagger: randomInt(0, 60),
    }
  }

  return next
}

/** Unlike `randomizePattern`, this also picks a new pattern KIND at random
 * — same "surprise me" reasoning as `randomizeShapeFully`, and for the
 * same reason (used only by "Randomize all"): switching kind first, then
 * handing off to `randomizePattern` for the actual parameter rolling
 * against that new kind. */
export function randomizePatternFully(pattern: PatternConfig): PatternConfig {
  const kind = randomChoice(PATTERN_KIND_ORDER)
  return randomizePattern({ ...pattern, kind })
}

/** Re-rolls a surface-detail pattern the same way `randomizePattern` does —
 * reused rather than duplicated, since a detail pattern's fields are a
 * strict subset of a full PatternConfig's (see SurfaceDetailPatternConfig).
 * Fills in the omitted fields with inert placeholders just to satisfy
 * `randomizePattern`'s signature, then strips them back off the result. */
export function randomizeSurfaceDetailPattern(pattern: SurfaceDetailPatternConfig): SurfaceDetailPatternConfig {
  const asFullPattern: PatternConfig = {
    ...pattern,
    mode: 'etch',
    nullShape: false,
    explodeAmount: 0,
    keepAllLevelsInCut: false,
    surfaceDetail: { enabled: false, pattern },
    edgeDetail: { ...DEFAULT_EDGE_DETAIL },
  }
  const randomized = randomizePattern(asFullPattern)
  return {
    kind: randomized.kind,
    cellSize: randomized.cellSize,
    jitter: randomized.jitter,
    seed: randomized.seed,
    symmetryCount: randomized.symmetryCount,
    mirrorSymmetry: randomized.mirrorSymmetry,
    mirrorHorizontal: randomized.mirrorHorizontal,
    mirrorVertical: randomized.mirrorVertical,
    hexOrientation: randomized.hexOrientation,
    edgeMargin: randomized.edgeMargin,
    strutWidth: randomized.strutWidth,
    minStrutWidth: randomized.minStrutWidth,
    kerf: randomized.kerf,
    cornerStyle: randomized.cornerStyle,
    recursion: randomized.recursion,
    trimSlivers: randomized.trimSlivers,
    sliverAreaRatio: randomized.sliverAreaRatio,
    radialModulation: randomized.radialModulation,
    dispersion: randomized.dispersion,
    stamp: randomized.stamp,
  }
}
