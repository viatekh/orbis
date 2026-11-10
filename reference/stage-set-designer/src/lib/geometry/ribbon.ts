import type { Point, Polygon } from './types'

/** Builds a closed ribbon polygon from a centerline by offsetting each
 * point left/right along its local perpendicular by a (possibly varying)
 * half-width, then walking out one edge and back the other. A half-width
 * of 0 collapses both edges onto the centerline point, so a smoothly
 * shrinking `halfWidthAt` tapers that end to a point with no extra logic.
 * Shared by the shape system (spiral/vine/leaf) and any line-tracing
 * pattern generator (vein/flow/manta) that needs the same stroke-to-fill
 * conversion. */
export function buildRibbonFromCenterline(centerline: Point[], halfWidthAt: (i: number) => number): Polygon {
  const n = centerline.length
  const left: Point[] = []
  const right: Point[] = []
  for (let i = 0; i < n; i++) {
    const prev = centerline[Math.max(0, i - 1)]
    const next = centerline[Math.min(n - 1, i + 1)]
    const tx = next.x - prev.x
    const ty = next.y - prev.y
    const len = Math.hypot(tx, ty) || 1
    const nx = -ty / len
    const ny = tx / len
    const hw = Math.max(0, halfWidthAt(i))
    const p = centerline[i]
    left.push({ x: p.x + nx * hw, y: p.y + ny * hw })
    right.push({ x: p.x - nx * hw, y: p.y - ny * hw })
  }
  return [...left, ...right.reverse()]
}
