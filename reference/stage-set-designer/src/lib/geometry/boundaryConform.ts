import type { Point, Polygon } from './types'

function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-12) return a
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

interface BoundaryProximity {
  distance: number
  /** The nearest edge's direction, normalized to [0, π) — unsigned, since
   * "run parallel to this edge" doesn't care which end is which. */
  tangentAngle: number
}

function nearestBoundaryProximity(boundary: Polygon, p: Point): BoundaryProximity {
  let best = Infinity
  let bestAngle = 0
  const n = boundary.length
  for (let i = 0; i < n; i++) {
    const a = boundary[i]
    const b = boundary[(i + 1) % n]
    const closest = closestPointOnSegment(p, a, b)
    const d = Math.hypot(closest.x - p.x, closest.y - p.y)
    if (d < best) {
      best = d
      let angle = Math.atan2(b.y - a.y, b.x - a.x)
      angle = ((angle % Math.PI) + Math.PI) % Math.PI
      bestAngle = angle
    }
  }
  return { distance: best, tangentAngle: bestAngle }
}

function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

/** Bends `baseAngle` toward running parallel to the nearest boundary edge
 * as `p` gets close to it — the "hugs the silhouette" effect real grain,
 * veins, or gills show near an edge instead of running straight through
 * it. Full pull right at the boundary, fading to none at `influenceDist`
 * away. Picks whichever of the edge's two parallel directions is closer to
 * `baseAngle` so a streamline never doubles back on itself mid-bend. */
export function conformAngleToBoundary(
  boundary: Polygon,
  p: Point,
  baseAngle: number,
  influenceDist: number,
  strength = 1,
): number {
  if (influenceDist <= 0) return baseAngle
  const { distance, tangentAngle } = nearestBoundaryProximity(boundary, p)
  const weight = Math.max(0, 1 - distance / influenceDist) * strength
  if (weight <= 0) return baseAngle

  const candidateA = tangentAngle
  const candidateB = tangentAngle + Math.PI
  const target =
    Math.abs(angleDiff(baseAngle, candidateA)) <= Math.abs(angleDiff(baseAngle, candidateB)) ? candidateA : candidateB
  return baseAngle + angleDiff(target, baseAngle) * weight
}

/** Re-walks an already-built centerline (e.g. a closed-form curve) step by
 * step, bending each step's direction toward the boundary the same way
 * `conformAngleToBoundary` does — turns a formula-defined curve into one
 * that hugs nearby edges, without needing that curve to be generated
 * step-by-step in the first place. Step lengths are preserved from the
 * input, so the output stays the same rough length/shape away from edges. */
export function conformCenterlineToBoundary(
  boundary: Polygon,
  points: Point[],
  influenceDist: number,
  strength = 1,
): Point[] {
  if (points.length < 2 || influenceDist <= 0) return points
  const out: Point[] = [points[0]]
  let cur = points[0]
  for (let i = 1; i < points.length; i++) {
    const prevRaw = points[i - 1]
    const raw = points[i]
    const stepLen = Math.hypot(raw.x - prevRaw.x, raw.y - prevRaw.y)
    const rawAngle = Math.atan2(raw.y - prevRaw.y, raw.x - prevRaw.x)
    const bentAngle = conformAngleToBoundary(boundary, cur, rawAngle, influenceDist, strength)
    const next: Point = { x: cur.x + Math.cos(bentAngle) * stepLen, y: cur.y + Math.sin(bentAngle) * stepLen }
    out.push(next)
    cur = next
  }
  return out
}
