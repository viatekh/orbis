import { bounds, centroid, scalePolygon, translatePolygon, area, signedArea } from './polygon'
import { intersectPolys, unionPolys } from './clipper'
import type { DispersionConfig, Polygon } from './types'

function boundsOverlap(a: Polygon, b: Polygon): boolean {
  const ba = bounds(a)
  const bb = bounds(b)
  return ba.minX <= bb.maxX && bb.minX <= ba.maxX && ba.minY <= bb.maxY && bb.minY <= ba.maxY
}

function polysOverlap(a: Polygon, b: Polygon): boolean {
  if (!boundsOverlap(a, b)) return false
  const inter = intersectPolys([a], [b])
  return inter.some((p) => area(p) > 1e-6)
}

/** Buckets each polygon's bounding box into a coarse grid so overlap
 * detection only has to check nearby candidates instead of every pair — an
 * all-pairs check is O(n²) real Clipper calls, which measured at ~26
 * SECONDS for a ~400-cell pattern (vs ~6ms with dispersion off) before this
 * existed. Registers a polygon in EVERY bucket its bounding box spans, not
 * just a single bucket for its centroid: this pass runs again on its own
 * output (see the loop in applyDispersion), and by the second pass some
 * "cells" are no longer small uniform squares but large, irregular fused
 * blobs whose centroid can sit far from parts of their own boundary.
 * Bucketing by centroid alone missed a small piece sitting near the edge
 * of such a blob (their centroids could be many buckets apart even though
 * the shapes actually touch); bucketing by bounding-box span finds it
 * regardless of shape or size. */
function buildSpatialIndex(polys: Polygon[], bucketSize: number): Map<string, number[]> {
  const index = new Map<string, number[]>()
  for (let i = 0; i < polys.length; i++) {
    const b = bounds(polys[i])
    const minBx = Math.floor(b.minX / bucketSize)
    const maxBx = Math.floor(b.maxX / bucketSize)
    const minBy = Math.floor(b.minY / bucketSize)
    const maxBy = Math.floor(b.maxY / bucketSize)
    for (let bx = minBx; bx <= maxBx; bx++) {
      for (let by = minBy; by <= maxBy; by++) {
        const key = `${bx},${by}`
        const list = index.get(key)
        if (list) list.push(i)
        else index.set(key, [i])
      }
    }
  }
  return index
}

function candidatesNear(poly: Polygon, index: Map<string, number[]>, bucketSize: number): number[] {
  const b = bounds(poly)
  const minBx = Math.floor(b.minX / bucketSize)
  const maxBx = Math.floor(b.maxX / bucketSize)
  const minBy = Math.floor(b.minY / bucketSize)
  const maxBy = Math.floor(b.maxY / bucketSize)
  const seen = new Set<number>()
  const result: number[] = []
  for (let bx = minBx; bx <= maxBx; bx++) {
    for (let by = minBy; by <= maxBy; by++) {
      const list = index.get(`${bx},${by}`)
      if (!list) continue
      for (const idx of list) {
        if (!seen.has(idx)) {
          seen.add(idx)
          result.push(idx)
        }
      }
    }
  }
  return result
}

/** Randomly scales and nudges each cell independently — see DispersionConfig
 * for why this is a separate axis from cellSize/jitter. Pure and
 * order-sensitive only in that it consumes `rng` once (size) then again
 * (direction + distance) per cell, per enabled axis — same "just keep
 * drawing from the stream" approach the pattern generators themselves use,
 * so toggling dispersion never perturbs draws anything else already made
 * before this runs.
 *
 * A cell moved/scaled on its own, with no awareness of its neighbors, can
 * easily end up overlapping one — and every attempt at "trim the loser
 * back to what's left" runs into the same wall: when one cell fully
 * swallows another, subtracting the swallowed one leaves a solid ring
 * with a hole in the middle, which is a shape this codebase's plain
 * Point[] polygons have no way to represent (Clipper reports that hole as
 * a second, oppositely-wound path with no link back to its parent, so
 * naively keeping it duplicates that area as if it were still solid —
 * the actual cause of cutouts overlapping/interfering after dispersion).
 * Fused instead: cells that end up overlapping after being moved are
 * unioned into one region rather than one carving up the other. That
 * mostly sidesteps the hole problem — but not entirely: fusing three or
 * more cells CAN still enclose a small gap nothing covers (picture three
 * circles overlapping in a ring, with a sliver left uncovered in the
 * middle), and Clipper reports that the same way, as an oppositely-wound
 * path. So the same filter applies here too: keep only the pieces wound
 * the same way as the input cells, and drop anything wound the other way
 * rather than adding it back in as if it were solid. */
export function applyDispersion(cells: Polygon[], cellSize: number, config: DispersionConfig, rng: () => number): Polygon[] {
  if (cells.length === 0 || !config.enabled || (config.sizeVariance <= 0 && config.distanceVariance <= 0)) return cells

  const moved = cells.map((cell) => {
    let poly = cell
    if (config.sizeVariance > 0) {
      const c = centroid(poly)
      const scale = Math.max(0.05, 1 + (rng() * 2 - 1) * config.sizeVariance)
      poly = scalePolygon(poly, c, scale)
    }
    if (config.distanceVariance > 0) {
      const angle = rng() * Math.PI * 2
      const dist = rng() * config.distanceVariance * cellSize
      poly = translatePolygon(poly, Math.cos(angle) * dist, Math.sin(angle) * dist)
    }
    return poly
  })

  const wantSign = Math.sign(signedArea(moved[0])) || 1
  // A single clustering pass can leave a residual overlap two different
  // ways: a big enough cluster nests more than one level deep (an island
  // of solid material inside a hole that's itself inside the outer
  // solid — Clipper reports that island the same way it reports an
  // ordinary piece, positively wound, so one filter pass can't tell it
  // apart from a genuinely separate piece), or two cells that truly end
  // up overlapping happen to land in non-adjacent spatial buckets and
  // never get pairwise-checked against each other at all. Rather than
  // trying to prove which one a given case is, running the whole
  // cluster-and-fuse pass again on its own output catches both: a
  // dangling overlap either gets swallowed into the piece it overlaps
  // (case one) or gets bucketed and checked freshly against its actual
  // neighbor this time (case two), while an already-clean set just comes
  // back unchanged and the loop stops. Capped as a safety net, not
  // because more than a couple of passes is expected in practice.
  let current = dedupeOverlaps(moved, cellSize, wantSign)
  for (let pass = 0; pass < 4; pass++) {
    const next = dedupeOverlaps(current, cellSize, wantSign)
    if (next.length === current.length) return next
    current = next
  }
  return current
}

/** One clustering pass: groups polygons into clusters of mutual overlap
 * (only checking spatially-nearby candidates via a grid, see
 * buildSpatialIndex — this is what keeps a dense pattern from paying for
 * an all-pairs O(n²) check), unions each cluster, and drops whatever
 * comes back wound opposite to `wantSign` (a hole, not a piece to keep). */
function dedupeOverlaps(polys: Polygon[], cellSize: number, wantSign: number): Polygon[] {
  if (polys.length <= 1) return polys

  const bucketSize = Math.max(cellSize * 3, 1)
  const index = buildSpatialIndex(polys, bucketSize)

  const parent = polys.map((_, i) => i)
  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  function union(a: number, b: number) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  for (let i = 0; i < polys.length; i++) {
    for (const j of candidatesNear(polys[i], index, bucketSize)) {
      if (j > i && find(i) !== find(j) && polysOverlap(polys[i], polys[j])) union(i, j)
    }
  }

  const clusters = new Map<number, number[]>()
  for (let i = 0; i < polys.length; i++) {
    const root = find(i)
    const list = clusters.get(root)
    if (list) list.push(i)
    else clusters.set(root, [i])
  }

  const result: Polygon[] = []
  for (const indices of clusters.values()) {
    if (indices.length === 1) {
      result.push(polys[indices[0]])
      continue
    }
    const fused = unionPolys(indices.map((i) => polys[i]))
    for (const piece of fused) {
      if (piece.length >= 3 && Math.sign(signedArea(piece)) === wantSign) result.push(piece)
    }
  }
  return result
}
