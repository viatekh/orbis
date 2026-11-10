import { area } from './polygon'
import { buildShapeOutline } from './shapes'
import type { EdgeDetailConfig, PatternConfig, ShapePrimitive, StampConfig } from './types'
import type { CenterHoleConfig } from '../../types'

const MIN_RATIO_AREA = 1e-6

/** Rounds to 0.01mm — plenty of precision for CNC/laser fabrication, and
 * keeps scaled values readable in the UI rather than trailing 15 digits of
 * float noise (e.g. 35.35533905932738 → 35.36). */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** Linear scale factor between two shapes' sizes — sqrt(newArea/oldArea),
 * since area scales with the square of a linear dimension. Area-based
 * (rather than reading width/height/radius directly) so it works
 * uniformly across every shape kind, including a change between kinds. */
export function shapeScaleRatio(oldShape: ShapePrimitive, newShape: ShapePrimitive): number {
  const oldArea = area(buildShapeOutline(oldShape))
  const newArea = area(buildShapeOutline(newShape))
  if (oldArea < MIN_RATIO_AREA || newArea < MIN_RATIO_AREA) return 1
  return Math.sqrt(newArea / oldArea)
}

export function scaleShapePrimitive(shape: ShapePrimitive, k: number): ShapePrimitive {
  switch (shape.kind) {
    case 'rect':
      return {
        ...shape,
        width: round2(shape.width * k),
        height: round2(shape.height * k),
        cornerRadius: round2(shape.cornerRadius * k),
      }
    case 'regularPolygon':
      return { ...shape, radius: round2(shape.radius * k), cornerRadius: round2(shape.cornerRadius * k) }
    case 'superellipse':
      return { ...shape, width: round2(shape.width * k), height: round2(shape.height * k) }
    case 'blob':
      return { ...shape, radius: round2(shape.radius * k) }
    case 'star':
      return { ...shape, radius: round2(shape.radius * k), cornerRadius: round2(shape.cornerRadius * k) }
    case 'teardrop':
      return { ...shape, radius: round2(shape.radius * k) }
    case 'diamond':
      return {
        ...shape,
        width: round2(shape.width * k),
        height: round2(shape.height * k),
        cornerRadius: round2(shape.cornerRadius * k),
      }
    case 'eye':
      return { ...shape, width: round2(shape.width * k), height: round2(shape.height * k) }
    case 'spiral':
      return {
        ...shape,
        startRadius: round2(shape.startRadius * k),
        endRadius: round2(shape.endRadius * k),
        strokeWidth: round2(shape.strokeWidth * k),
      }
    case 'vine':
      return {
        ...shape,
        length: round2(shape.length * k),
        amplitude: round2(shape.amplitude * k),
        strokeWidth: round2(shape.strokeWidth * k),
      }
    case 'leaf':
      return { ...shape, length: round2(shape.length * k), maxWidth: round2(shape.maxWidth * k) }
    case 'freeform':
      return {
        ...shape,
        points: shape.points.map((p) => ({
          x: round2(p.x * k),
          y: round2(p.y * k),
          hx: round2(p.hx * k),
          hy: round2(p.hy * k),
        })),
      }
    case 'feather':
      return {
        ...shape,
        length: round2(shape.length * k),
        spineWidth: round2(shape.spineWidth * k),
        barbLength: round2(shape.barbLength * k),
        barbWidth: round2(shape.barbWidth * k),
      }
  }
}

function scaleStamp(stamp: StampConfig, k: number): StampConfig {
  return { ...stamp, ringSpacing: round2(stamp.ringSpacing * k), shape: scaleShapePrimitive(stamp.shape, k) }
}

function scaleEdgeDetail(edgeDetail: EdgeDetailConfig, k: number): EdgeDetailConfig {
  return {
    ...edgeDetail,
    spacing: round2(edgeDetail.spacing * k),
    size: round2(edgeDetail.size * k),
    offset: round2(edgeDetail.offset * k),
  }
}

/** Rescales a pattern's absolute-mm parameters by `k` so it keeps looking
 * proportionate after its shape is resized — cell size, edge margin,
 * explode amount, the stamp motif and its ring spacing, and the
 * minCellArea threshold (an area, so it scales by k²). Strut width scales
 * too, but is clamped back up to minStrutWidth if that would push it below
 * the fabricable minimum. Fabrication-critical fields that are tied to the
 * real machine/material rather than the design — kerf, minStrutWidth — are
 * deliberately left untouched, as are dimensionless fields (jitter,
 * radialModulation's ratios/degrees, counts, seeds, kinds, flags). Also
 * scales `edgeDetail` (spacing/size/offset around the outer edge) — not
 * present on the nested surface-detail pattern, which omits edgeDetail
 * entirely (SurfaceDetailPatternConfig). Applies the cellSize/edgeMargin/
 * strutWidth/recursion/stamp treatment recursively to the surface-detail
 * pattern too, if any. */
export function scalePatternForShape(pattern: PatternConfig, k: number): PatternConfig {
  if (k === 1) return pattern
  return {
    ...pattern,
    cellSize: round2(pattern.cellSize * k),
    edgeMargin: round2(pattern.edgeMargin * k),
    explodeAmount: round2(pattern.explodeAmount * k),
    strutWidth: Math.max(pattern.minStrutWidth, round2(pattern.strutWidth * k)),
    recursion: { ...pattern.recursion, minCellArea: round2(pattern.recursion.minCellArea * k * k) },
    stamp: scaleStamp(pattern.stamp, k),
    edgeDetail: scaleEdgeDetail(pattern.edgeDetail, k),
    surfaceDetail: {
      ...pattern.surfaceDetail,
      pattern: {
        ...pattern.surfaceDetail.pattern,
        cellSize: round2(pattern.surfaceDetail.pattern.cellSize * k),
        edgeMargin: round2(pattern.surfaceDetail.pattern.edgeMargin * k),
        strutWidth: Math.max(
          pattern.surfaceDetail.pattern.minStrutWidth,
          round2(pattern.surfaceDetail.pattern.strutWidth * k),
        ),
        recursion: {
          ...pattern.surfaceDetail.pattern.recursion,
          minCellArea: round2(pattern.surfaceDetail.pattern.recursion.minCellArea * k * k),
        },
        stamp: scaleStamp(pattern.surfaceDetail.pattern.stamp, k),
      },
    },
  }
}

/** Same idea as `scalePatternForShape`, for a center hole: its own offset
 * from the component center, its clearance margin, its own shape, and its
 * rim's edgeDetail all scale — `enabled` doesn't, it's a flag. */
export function scaleCenterHole(centerHole: CenterHoleConfig, k: number): CenterHoleConfig {
  if (k === 1) return centerHole
  return {
    ...centerHole,
    offsetX: round2(centerHole.offsetX * k),
    offsetY: round2(centerHole.offsetY * k),
    margin: round2(centerHole.margin * k),
    shape: scaleShapePrimitive(centerHole.shape, k),
    edgeDetail: scaleEdgeDetail(centerHole.edgeDetail, k),
  }
}
