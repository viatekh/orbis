import { buildShapeOutline } from '../../lib/geometry/shapes'
import type { FreeformPoint, Point, ShapePrimitive } from '../../types'

export const SHAPE_OPTIONS: { value: ShapePrimitive['kind']; label: string }[] = [
  { value: 'rect', label: 'Rectangle' },
  { value: 'regularPolygon', label: 'Regular polygon' },
  { value: 'superellipse', label: 'Superellipse (squircle)' },
  { value: 'star', label: 'Star' },
  { value: 'blob', label: 'Blob (organic)' },
  { value: 'teardrop', label: 'Teardrop' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'eye', label: 'Eye' },
  { value: 'spiral', label: 'Spiral (swirl / swoosh)' },
  { value: 'vine', label: 'Vine (flowing / leaf)' },
  { value: 'leaf', label: 'Leaf (spine profile)' },
  { value: 'freeform', label: 'Freeform (hand-sculpted)' },
  { value: 'feather', label: 'Feather (spine + barbs)' },
]

/** A point's default pull handle: proportional to the distance between its
 * two neighbors (the standard Catmull-Rom-to-Bezier smoothing constant,
 * 1/6, applied to a chord through the neighbors) — gives every new point a
 * sensible smooth tangent before the user ever touches its handle. */
export function autoHandle(points: Point[], i: number): { hx: number; hy: number } {
  const n = points.length
  const prev = points[(i - 1 + n) % n]
  const next = points[(i + 1) % n]
  return { hx: (next.x - prev.x) / 6, hy: (next.y - prev.y) / 6 }
}

/** A gentle rounded-blob starting point for a freeform shape — regular
 * enough to be a sensible default, irregular enough (points, not a
 * perfect polygon count like 6 or 8) that it doesn't read as "actually a
 * different shape kind in disguise." */
export function defaultFreeformPoints(): FreeformPoint[] {
  const n = 7
  const radius = 150
  const positions: Point[] = Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) }
  })
  return positions.map((p, i) => ({ ...p, ...autoHandle(positions, i) }))
}

/** Symmetrizes a hand-sculpted outline by keeping only the points on one
 * side of the centroid (along whichever axis) and mirroring them onto the
 * other — a quick "make what I already drew symmetric" action, since
 * sculpting a bilaterally-symmetric curve by eye, point by point, is hard
 * to do free-hand. Points are re-sorted along the OTHER axis first so the
 * mirrored half connects in a sane loop order regardless of the order the
 * user happened to place them in. Handles are recomputed fresh from the
 * final point positions rather than reflected/carried over — simpler and
 * more robust than reasoning through what a mirrored-and-reversed handle
 * should be, and still lands smooth since auto-handles only look at
 * neighbor positions. */
export function mirrorFreeformPoints(points: FreeformPoint[], axis: 'vertical' | 'horizontal'): FreeformPoint[] {
  if (points.length < 3) return points
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length

  const kept = axis === 'vertical' ? points.filter((p) => p.x <= cx) : points.filter((p) => p.y <= cy)
  if (kept.length < 2) return points

  const sorted = axis === 'vertical' ? [...kept].sort((a, b) => a.y - b.y) : [...kept].sort((a, b) => a.x - b.x)
  const mirroredPositions: Point[] = sorted
    .map((p) => (axis === 'vertical' ? { x: 2 * cx - p.x, y: p.y } : { x: p.x, y: 2 * cy - p.y }))
    .reverse()
    // Drop a mirrored point that would land right on top of its source
    // (points essentially on the axis already) to avoid a degenerate
    // zero-length edge at the seam.
    .filter((p, i) => {
      const src = sorted[sorted.length - 1 - i]
      return Math.hypot(p.x - src.x, p.y - src.y) > 0.5
    })

  const positions: Point[] = [...sorted.map((p) => ({ x: p.x, y: p.y })), ...mirroredPositions]
  return positions.map((p, i) => ({ ...p, ...autoHandle(positions, i) }))
}

/** Converts any shape kind's current outline into an editable freeform
 * point set that preserves its silhouette, rather than starting hand-
 * editing over from a blank default circle. The outline is resampled at
 * even arc-length steps down to `targetCount` points (a coarse polygon
 * kind like rect/diamond that already has fewer vertices than that is
 * used as-is, not padded back up), then each gets a smooth auto-handle
 * from its neighbors — a reasonable, immediately-editable approximation
 * of the original curve, not a pixel-exact trace. */
export function convertToFreeform(shape: ShapePrimitive, targetCount = 24): FreeformPoint[] {
  const outline = buildShapeOutline(shape)
  const n = outline.length

  let positions: Point[]
  if (n <= targetCount) {
    positions = outline
  } else {
    let perimeter = 0
    const cumulative: number[] = [0]
    for (let i = 0; i < n; i++) {
      const a = outline[i]
      const b = outline[(i + 1) % n]
      perimeter += Math.hypot(b.x - a.x, b.y - a.y)
      cumulative.push(perimeter)
    }
    positions = []
    let edgeIndex = 0
    for (let k = 0; k < targetCount; k++) {
      const s = (perimeter * k) / targetCount
      while (edgeIndex < n - 1 && cumulative[edgeIndex + 1] <= s) edgeIndex++
      const a = outline[edgeIndex]
      const b = outline[(edgeIndex + 1) % n]
      const edgeLen = cumulative[edgeIndex + 1] - cumulative[edgeIndex] || 1
      const t = (s - cumulative[edgeIndex]) / edgeLen
      positions.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }

  return positions.map((p, i) => ({ ...p, ...autoHandle(positions, i) }))
}

export function defaultShapeFor(kind: ShapePrimitive['kind']): ShapePrimitive {
  switch (kind) {
    case 'rect':
      return { kind: 'rect', width: 300, height: 200, cornerRadius: 0 }
    case 'regularPolygon':
      return { kind: 'regularPolygon', sides: 6, radius: 150, rotation: 0, cornerRadius: 0 }
    case 'superellipse':
      return { kind: 'superellipse', width: 300, height: 200, exponent: 4 }
    case 'star':
      return { kind: 'star', points: 5, radius: 150, innerRadiusRatio: 0.5, rotation: -90, cornerRadius: 0 }
    case 'blob':
      return { kind: 'blob', radius: 150, complexity: 4, irregularity: 0.3, seed: 1 }
    case 'teardrop':
      return { kind: 'teardrop', radius: 150, pointSharpness: 1.3, rotation: -90 }
    case 'diamond':
      return { kind: 'diamond', width: 200, height: 300, cornerRadius: 0 }
    case 'eye':
      return { kind: 'eye', width: 300, height: 140, rotation: 0 }
    case 'spiral':
      return { kind: 'spiral', turns: 1.5, startRadius: 5, endRadius: 150, strokeWidth: 30, rotation: 0 }
    case 'vine':
      return { kind: 'vine', length: 300, amplitude: 50, waveCount: 2, strokeWidth: 24, leafBulge: 0.6, rotation: 0 }
    case 'leaf':
      return {
        kind: 'leaf',
        length: 320,
        maxWidth: 160,
        widthPosition: 0.42,
        baseTaper: 1.2,
        tipTaper: 1.6,
        curvature: 0,
        rotation: -90,
      }
    case 'freeform':
      return { kind: 'freeform', points: defaultFreeformPoints() }
    case 'feather':
      return {
        kind: 'feather',
        length: 320,
        spineWidth: 14,
        barbCount: 14,
        barbLength: 60,
        barbWidth: 10,
        barbSweep: 35,
        rotation: 0,
      }
  }
}
