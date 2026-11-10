import { sampleBoundary } from './boundarySample'
import { area } from './polygon'
import type { Point, Polygon } from './types'

/** A single rectangular assembly tab standing perpendicular OUT from the
 * boundary at `point`, `depth` mm long and `width` mm wide — a real,
 * simple standoff/connector shape, not a decorative motif. Reuses the
 * inward-normal convention from boundarySample (negated, since a fin
 * needs to stand outward, away from the piece it's attached to). */
function buildFin(point: Point, inward: Point, depth: number, width: number): Polygon {
  const nx = -inward.x
  const ny = -inward.y
  const tx = -ny
  const ty = nx
  const halfW = width / 2
  const base1: Point = { x: point.x + tx * halfW, y: point.y + ty * halfW }
  const base2: Point = { x: point.x - tx * halfW, y: point.y - ty * halfW }
  const tip1: Point = { x: base1.x + nx * depth, y: base1.y + ny * depth }
  const tip2: Point = { x: base2.x + nx * depth, y: base2.y + ny * depth }
  return [base1, tip1, tip2, base2]
}

/** Assembly fins standing out from a layer's own outer silhouette(s), sized
 * to bridge the Z-gap (`depth`, mm) to the next layer in the stack — the
 * first real piece of the Arrangement view's move toward 3D: a physical
 * tab a builder could glue or slot to connect this layer to its neighbor,
 * spaced evenly around each disjoint outline at roughly `spacing` mm
 * apart. Purely additive geometry (not cut into anything, not slotted
 * into the neighboring layer) — a starting point, not a finished
 * interlocking joinery system. */
export function buildLayerFins(outlines: Polygon[], depth: number, width = 6, spacing = 40): Polygon[] {
  if (depth <= 0 || outlines.length === 0) return []

  // `outlines` mixes each piece's outer silhouette together with any of
  // its holes (e.g. a Portal opening) in one flat array — position alone
  // no longer tells outer from hole apart once multiple instances are
  // combined. Fins only make sense around an outer silhouette, so small
  // contours relative to the largest one here are treated as holes and
  // skipped, rather than trying to reconstruct per-instance nesting.
  const largest = Math.max(...outlines.map((o) => area(o)))
  const outerPieces = outlines.filter((o) => area(o) > largest * 0.1)

  const fins: Polygon[] = []
  for (const outline of outerPieces) {
    const samples = sampleBoundary(outline, spacing)
    for (const { point, inward } of samples) {
      fins.push(buildFin(point, inward, depth, width))
    }
  }
  return fins
}
