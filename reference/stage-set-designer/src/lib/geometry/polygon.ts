import type { Bounds, Point, Polygon } from './types'

export function stripClosingPoint(poly: Polygon): Polygon {
  if (poly.length > 1) {
    const first = poly[0]
    const last = poly[poly.length - 1]
    if (first.x === last.x && first.y === last.y) return poly.slice(0, -1)
  }
  return poly
}

export function signedArea(poly: Polygon): number {
  let sum = 0
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

export function area(poly: Polygon): number {
  return Math.abs(signedArea(poly))
}

export function centroid(poly: Polygon): Point {
  const n = poly.length
  if (n === 0) return { x: 0, y: 0 }
  let cx = 0
  let cy = 0
  let a = 0
  for (let i = 0; i < n; i++) {
    const p0 = poly[i]
    const p1 = poly[(i + 1) % n]
    const cross = p0.x * p1.y - p1.x * p0.y
    cx += (p0.x + p1.x) * cross
    cy += (p0.y + p1.y) * cross
    a += cross
  }
  a *= 0.5
  if (Math.abs(a) < 1e-9) {
    // degenerate polygon — fall back to vertex average
    const sum = poly.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
    return { x: sum.x / n, y: sum.y / n }
  }
  return { x: cx / (6 * a), y: cy / (6 * a) }
}

export function bounds(poly: Polygon): Bounds {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of poly) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export function mergeBounds(a: Bounds | null, b: Bounds): Bounds {
  if (!a) return b
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  }
}

const EMPTY_BOUNDS: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }

export function boundsOfPolygons(polys: Polygon[]): Bounds {
  return polys.reduce<Bounds | null>((acc, p) => mergeBounds(acc, bounds(p)), null) ?? EMPTY_BOUNDS
}

export function maxDistanceFrom(point: Point, poly: Polygon): number {
  let max = 0
  for (const p of poly) {
    const d = Math.hypot(p.x - point.x, p.y - point.y)
    if (d > max) max = d
  }
  return max
}

export function scalePolygon(poly: Polygon, center: Point, scale: number): Polygon {
  return poly.map((p) => ({
    x: center.x + (p.x - center.x) * scale,
    y: center.y + (p.y - center.y) * scale,
  }))
}

export function rotatePolygon(poly: Polygon, center: Point, angleDeg: number): Polygon {
  if (angleDeg === 0) return poly
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return poly.map((p) => {
    const dx = p.x - center.x
    const dy = p.y - center.y
    return { x: center.x + dx * cos - dy * sin, y: center.y + dx * sin + dy * cos }
  })
}

/** Reflects `poly` across the line through `center` at `axisAngleDeg`
 * (same angle convention as `rotatePolygon`) — the standard 2D reflection
 * matrix [[cos2θ, sin2θ], [sin2θ, -cos2θ]], applied around `center`. Used
 * to build kaleidoscope-style mirror symmetry: a half-wedge of pattern
 * content reflected across its own far edge produces a bilaterally
 * symmetric full wedge, seamless at the mirror line by construction. */
export function mirrorPolygon(poly: Polygon, center: Point, axisAngleDeg: number): Polygon {
  const rad = (axisAngleDeg * Math.PI) / 180
  const cos2 = Math.cos(2 * rad)
  const sin2 = Math.sin(2 * rad)
  return poly.map((p) => {
    const dx = p.x - center.x
    const dy = p.y - center.y
    return { x: center.x + dx * cos2 + dy * sin2, y: center.y + dx * sin2 - dy * cos2 }
  })
}

export function translatePolygon(poly: Polygon, dx: number, dy: number): Polygon {
  if (dx === 0 && dy === 0) return poly
  return poly.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

export function minEdgeLength(poly: Polygon): number {
  const n = poly.length
  let min = Infinity
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const d = Math.hypot(b.x - a.x, b.y - a.y)
    if (d < min) min = d
  }
  return min
}
