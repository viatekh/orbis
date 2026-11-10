import { signedArea } from './polygon'
import type { Point, Polygon } from './types'

export interface BoundarySample {
  point: Point
  /** Unit normal pointing into the polygon's OWN interior — derived from
   * winding (signedArea), not assumed, so it's correct regardless of which
   * way the source polygon happens to be wound. */
  inward: Point
  /** Arc length from the boundary's start point (poly[0]) to this sample. */
  s: number
}

export function polygonPerimeter(poly: Polygon): number {
  let p = 0
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    p += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return p
}

/** Resamples a closed polygon boundary at even arc-length steps (as close
 * to `targetSpacing` as an integer number of steps allows), each with a
 * point, its arc-length position, and the inward unit normal there.
 * Shared by anything that stamps or bands a motif along a boundary at
 * regular intervals — edge-detail decoration, assembly fins, and any
 * future perimeter-walking feature. */
export function sampleBoundary(poly: Polygon, targetSpacing: number): BoundarySample[] {
  const n = poly.length
  if (n < 3 || targetSpacing <= 0) return []
  const cumulative: number[] = [0]
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    cumulative.push(cumulative[i] + Math.hypot(b.x - a.x, b.y - a.y))
  }
  const perimeter = cumulative[n]
  if (perimeter < 1e-6) return []
  const ccw = signedArea(poly) > 0
  const steps = Math.max(3, Math.round(perimeter / targetSpacing))
  const actualSpacing = perimeter / steps

  const samples: BoundarySample[] = []
  let edgeIndex = 0
  for (let k = 0; k < steps; k++) {
    const s = k * actualSpacing
    while (edgeIndex < n - 1 && cumulative[edgeIndex + 1] <= s) edgeIndex++
    const a = poly[edgeIndex]
    const b = poly[(edgeIndex + 1) % n]
    const edgeLen = cumulative[edgeIndex + 1] - cumulative[edgeIndex] || 1
    const t = (s - cumulative[edgeIndex]) / edgeLen
    const point: Point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    const tx = (b.x - a.x) / edgeLen
    const ty = (b.y - a.y) / edgeLen
    // Interior is to the left of travel for a CCW ring, to the right for CW.
    const inward: Point = ccw ? { x: -ty, y: tx } : { x: ty, y: -tx }
    samples.push({ point, inward, s })
  }
  return samples
}
