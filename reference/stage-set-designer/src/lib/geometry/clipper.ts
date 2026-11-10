// The ONLY file in this codebase that imports clipper2-ts. Swapping offset/
// boolean engines later means touching only this file.
import {
  inflatePathsD,
  intersectD,
  unionD,
  differenceD,
  xorD,
  isPositiveD,
  reversePathD,
  pointInPolygonD,
  simplifyPathD,
  FillRule,
  JoinType,
  EndType,
  PointInPolygonResult,
  type PathD,
  type PathsD,
} from 'clipper2-ts'
import { PRECISION, ARC_TOLERANCE } from './constants'
import { stripClosingPoint } from './polygon'
import type { CornerStyle, Point, Polygon } from './types'

const MITER_LIMIT = 2

function toPathD(poly: Polygon): PathD {
  const stripped = stripClosingPoint(poly)
  const path: PathD = stripped.map((p) => ({ x: p.x, y: p.y }))
  // Clipper's offset direction depends on ring orientation as IT defines it —
  // always normalize to "positive" so a positive delta reliably shrinks.
  return isPositiveD(path) ? path : reversePathD(path)
}

/** Boolean ops (union/intersect/difference/xor) must NOT normalize
 * orientation like toPathD does: NonZero fill only cares whether winding is
 * zero, not its sign, for independent (non-nested) contours — but for a
 * NESTED contour (a hole inside an outer boundary, e.g. the output of a
 * previous boolean op fed back in as input) the hole's winding must stay
 * OPPOSITE the outer boundary's to still read as a hole. Forcing it
 * positive would flip it to "solid", silently filling the hole in. */
function toPathDRaw(poly: Polygon): PathD {
  return stripClosingPoint(poly).map((p) => ({ x: p.x, y: p.y }))
}

function fromPathD(path: PathD): Polygon {
  return stripClosingPoint(path.map((p): Point => ({ x: p.x, y: p.y })))
}

function fromPathsD(paths: PathsD): Polygon[] {
  return paths.map(fromPathD).filter((p) => p.length >= 3)
}

function joinTypeFor(style: CornerStyle | undefined): JoinType {
  return style === 'miter' ? JoinType.Miter : JoinType.Round
}

/** Shrinks (positive delta) or grows (negative delta) a single polygon. May
 * split into multiple pieces or vanish entirely, hence the array return. */
export function inset(poly: Polygon, delta: number, style?: CornerStyle): Polygon[] {
  if (delta === 0) return [poly]
  const result = inflatePathsD(
    [toPathD(poly)],
    -delta,
    joinTypeFor(style),
    EndType.Polygon,
    MITER_LIMIT,
    PRECISION,
    ARC_TOLERANCE,
  )
  return fromPathsD(result)
}

export function outset(poly: Polygon, delta: number, style?: CornerStyle): Polygon[] {
  return inset(poly, -delta, style)
}

export function intersectPolys(subject: Polygon[], clip: Polygon[]): Polygon[] {
  if (subject.length === 0 || clip.length === 0) return []
  const result = intersectD(subject.map(toPathDRaw), clip.map(toPathDRaw), FillRule.NonZero, PRECISION)
  return fromPathsD(result)
}

export function unionPolys(polys: Polygon[]): Polygon[] {
  if (polys.length === 0) return []
  const result = unionD(polys.map(toPathDRaw), FillRule.NonZero)
  return fromPathsD(result)
}

export function differencePolys(subject: Polygon[], clip: Polygon[]): Polygon[] {
  if (subject.length === 0) return []
  if (clip.length === 0) return subject
  const result = differenceD(subject.map(toPathDRaw), clip.map(toPathDRaw), FillRule.NonZero, PRECISION)
  return fromPathsD(result)
}

/** Symmetric difference of two polygon sets (regions in exactly one of the
 * two, not both). Chaining this pairwise across N sets computes the correct
 * N-way "odd coverage" exclude, since symmetric difference is associative. */
export function xorPolys(subject: Polygon[], clip: Polygon[]): Polygon[] {
  if (subject.length === 0) return clip
  if (clip.length === 0) return subject
  const result = xorD(subject.map(toPathDRaw), clip.map(toPathDRaw), FillRule.NonZero, PRECISION)
  return fromPathsD(result)
}

/** Morphological opening: shrink then grow by the same radius. Straight
 * edges return to their original position; convex corners come out as true
 * arcs. A radius too large for the polygon collapses it — callers should
 * clamp against minEdgeLength() first. */
export function roundCorners(poly: Polygon, radius: number): Polygon {
  if (radius <= 0) return poly
  const shrunk = inset(poly, radius, 'round')
  if (shrunk.length === 0) return poly
  const grown = outset(shrunk[0], radius, 'round')
  return grown[0] ?? poly
}

/** Reduces vertex count on smooth/organic boundaries (Douglas-Peucker style)
 * so per-cell clipping against them stays cheap. Safe to use for an
 * internal clipping target as long as final output still gets intersected
 * against the true, unsimplified outline (see pipeline.ts). */
export function simplify(poly: Polygon, epsilon: number): Polygon {
  if (epsilon <= 0) return poly
  const result = simplifyPathD(toPathD(poly), epsilon, true)
  return fromPathD(result)
}

export function containsPoint(pt: Point, poly: Polygon): boolean {
  const result = pointInPolygonD({ x: pt.x, y: pt.y }, toPathD(poly), PRECISION)
  return result !== PointInPolygonResult.IsOutside
}
