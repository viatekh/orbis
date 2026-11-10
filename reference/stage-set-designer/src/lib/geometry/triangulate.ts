import { signedArea, bounds } from './polygon'
import { differencePolys, intersectPolys } from './clipper'
import type { Bounds, Point, Polygon } from './types'

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function isPointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = cross(a, b, p)
  const d2 = cross(b, c, p)
  const d3 = cross(c, a, p)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

/** True proper crossing only — segments that merely touch at a shared
 * endpoint (which a bridge legitimately does, at both its own ends) don't
 * count, since the strict `>0`/`<0` comparisons both fail exactly at a
 * shared point. */
function segmentsProperlyIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

/** Ear-clipping triangulation of a SIMPLE (non-self-intersecting) polygon —
 * no holes. Only reflex vertices are ever tested for "is this ear blocked,"
 * since a convex vertex can never sit inside a valid ear triangle — for the
 * mostly-convex shapes this app deals with (cells, motifs, outlines) that
 * turns the usual O(n³) worst case into something close to O(n²) or better
 * in practice, since `reflex` is often small or empty. */
export function triangulateEarClip(polyIn: Polygon): Polygon[] {
  const poly = signedArea(polyIn) < 0 ? [...polyIn].reverse() : [...polyIn]
  let idx = poly.map((_, i) => i)
  if (idx.length < 3) return []

  const triangles: Polygon[] = []
  let guard = 0
  const maxGuard = idx.length * idx.length + 200

  while (idx.length > 3 && guard < maxGuard) {
    guard++
    const reflex: number[] = []
    for (let i = 0; i < idx.length; i++) {
      const a = poly[idx[(i - 1 + idx.length) % idx.length]]
      const b = poly[idx[i]]
      const c = poly[idx[(i + 1) % idx.length]]
      if (cross(a, b, c) <= 0) reflex.push(idx[i])
    }

    let removed = false
    for (let i = 0; i < idx.length; i++) {
      const iPrev = idx[(i - 1 + idx.length) % idx.length]
      const iCur = idx[i]
      const iNext = idx[(i + 1) % idx.length]
      const a = poly[iPrev]
      const b = poly[iCur]
      const c = poly[iNext]
      if (cross(a, b, c) <= 0) continue
      let blocked = false
      for (const j of reflex) {
        if (j === iPrev || j === iCur || j === iNext) continue
        if (isPointInTriangle(poly[j], a, b, c)) {
          blocked = true
          break
        }
      }
      if (blocked) continue
      triangles.push([a, b, c])
      idx = idx.filter((_, k) => k !== i)
      removed = true
      break
    }
    if (!removed) break // degenerate/self-intersecting input — bail rather than spin forever
  }
  if (idx.length === 3) triangles.push([poly[idx[0]], poly[idx[1]], poly[idx[2]]])
  if (idx.length > 3) console.warn('[triangulateEarClip] stuck with', idx.length, 'vertices remaining out of', poly.length)
  return triangles
}

function centroidOf(poly: Polygon): Point {
  const sum = poly.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
  return { x: sum.x / poly.length, y: sum.y / poly.length }
}

/** Does segment (a,b) cross any edge of `loop`, other than the one or two
 * edges touching `a` at index `skipIndex` (a bridge legitimately meets its
 * own polygon there — that's not a crossing to reject). Pass -1 to check
 * every edge (used for polygons `a`/`b` aren't actually vertices of). */
function crossesLoop(a: Point, b: Point, loop: Polygon, skipIndex: number): boolean {
  const n = loop.length
  for (let k = 0; k < n; k++) {
    const k2 = (k + 1) % n
    if (k === skipIndex || k2 === skipIndex) continue
    if (segmentsProperlyIntersect(a, b, loop[k], loop[k2])) return true
  }
  return false
}

const CANDIDATE_LIMIT = 48
const NEAREST_OUTER_POOL = 120

/** Finds a bridge from `hole` into `current` that doesn't cross `current`
 * itself, `hole` itself, or any polygon in `otherHoles` (holes not yet
 * merged in) — unlike a plain nearest-point bridge, which has no such
 * guarantee and will readily produce crossing bridges once there are
 * enough holes for two nearest-point pairs to tangle (exactly what a dense
 * ~80-cell voronoi pattern triggers almost every time). Candidates are
 * tried nearest-first and capped, rather than exhaustively, to stay fast
 * even once `current` has grown large from earlier merges — for realistic
 * pattern geometry (edge margins, strut gaps already keeping cells apart)
 * the first candidate or two almost always validates. */
function findBridge(current: Polygon, hole: Polygon, otherHoles: Polygon[]): { outerIndex: number; holeIndex: number } | null {
  const holeCenter = centroidOf(hole)
  const outerPool =
    current.length <= NEAREST_OUTER_POOL
      ? current.map((_, i) => i)
      : current
          .map((p, i) => ({ i, d: Math.hypot(p.x - holeCenter.x, p.y - holeCenter.y) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, NEAREST_OUTER_POOL)
          .map((e) => e.i)

  const candidates: { i: number; j: number; d: number }[] = []
  for (const i of outerPool) {
    for (let j = 0; j < hole.length; j++) {
      const d = Math.hypot(current[i].x - hole[j].x, current[i].y - hole[j].y)
      candidates.push({ i, j, d })
    }
  }
  candidates.sort((a, b) => a.d - b.d)

  for (const cand of candidates.slice(0, CANDIDATE_LIMIT)) {
    const a = current[cand.i]
    const b = hole[cand.j]
    if (crossesLoop(a, b, current, cand.i)) continue
    if (crossesLoop(a, b, hole, cand.j)) continue
    if (otherHoles.some((other) => crossesLoop(a, b, other, -1))) continue
    return { outerIndex: cand.i, holeIndex: cand.j }
  }
  return null
}

/** Merges each hole into the outer polygon via a validated bridge (see
 * `findBridge`) — the trick that turns a polygon-with-holes into one
 * simple (self-touching) polygon plain ear-clipping can handle, since
 * ear-clipping doesn't know what a "hole" is on its own. Holes are merged
 * largest-first: a bigger hole is more constrained about where it CAN
 * bridge without crossing something, so giving it first pick of the still-
 * uncluttered outer boundary reduces how often a later hole is forced into
 * the no-valid-candidate fallback. */
function bridgeHoles(outer: Polygon, holesIn: Polygon[]): Polygon {
  const bySize = [...holesIn].filter((h) => h.length >= 3).sort((a, b) => polygonBoundingSpan(b) - polygonBoundingSpan(a))
  let result = [...outer]
  for (let h = 0; h < bySize.length; h++) {
    const hole = bySize[h]
    const remaining = bySize.slice(h + 1)
    const found = findBridge(result, hole, remaining)
    // No validated candidate among the pool (rare — very cluttered local
    // geometry): fall back to the plain nearest-point pair rather than
    // dropping the hole entirely. May reintroduce a crossing in this one
    // spot, but that's a far smaller, more contained defect than the
    // previous unconditional behavior.
    if (!found) console.warn('[bridgeHoles] fallback for hole', h, 'of', bySize.length)
    const { outerIndex, holeIndex } = found ?? nearestPairFallback(result, hole)

    // The bridge-out leg retraces the bridge-in leg almost exactly (same
    // two points, opposite direction) — a zero-width "slit," which is the
    // whole trick that lets ear-clipping treat a hole as part of one
    // simple polygon. But EXACTLY coincident/collinear points are also
    // exactly what breaks ear-clipping's convex/point-in-triangle tests
    // (degenerate zero-area candidates that never resolve as valid ears).
    // Nudging the two return-leg vertices a hair off the bridge line —
    // far below fabrication tolerance, and negligible even at 3D-print
    // scale — keeps the slit geometrically closed while giving the
    // triangulator two DISTINCT, non-collinear points to work with.
    const a = result[outerIndex]
    const b = hole[holeIndex]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    // 0.01mm — far below any real fabrication tolerance (laser kerf and
    // FDM nozzle precision are both an order of magnitude coarser), but
    // large enough that the cross-product sign tests below don't fall
    // into floating-point cancellation noise the way ~0.0001mm did.
    const eps = 0.01
    const px = (-dy / len) * eps
    const py = (dx / len) * eps
    const aOut: Point = { x: a.x + px, y: a.y + py }
    const bOut: Point = { x: b.x + px, y: b.y + py }

    const holeLoop = [b, ...hole.slice(holeIndex + 1), ...hole.slice(0, holeIndex), bOut]
    result = [...result.slice(0, outerIndex + 1), ...holeLoop, aOut, ...result.slice(outerIndex + 1)]
  }
  return result
}

function polygonBoundingSpan(poly: Polygon): number {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of poly) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return Math.max(maxX - minX, maxY - minY)
}

function nearestPairFallback(outer: Polygon, hole: Polygon): { outerIndex: number; holeIndex: number } {
  let bestI = 0
  let bestJ = 0
  let bestDist = Infinity
  for (let i = 0; i < outer.length; i++) {
    for (let j = 0; j < hole.length; j++) {
      const d = Math.hypot(outer[i].x - hole[j].x, outer[i].y - hole[j].y)
      if (d < bestDist) {
        bestDist = d
        bestI = i
        bestJ = j
      }
    }
  }
  return { outerIndex: bestI, holeIndex: bestJ }
}

function boundsOverlap(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

/** Triangulates `outer` with `holes` cut out of it.
 *
 * Bridging EVERY hole into one giant polygon and ear-clipping it once
 * turned out not to hold up at real scale: a ~110-hole voronoi pattern
 * left ear-clipping permanently stuck partway through (a chunk of the
 * mesh just never got triangulated — the reported bug), because a single
 * ~1000-vertex polygon riddled with a hundred thin bridge "slits" is
 * exactly the kind of degenerate input hand-rolled ear-clipping struggles
 * with, even with a validated (non-crossing) bridge for every hole.
 *
 * Instead: chop `outer`'s bounding box into a grid, and for each cell,
 * hand the actual multi-hole boolean work to Clipper2 (`intersectPolys` /
 * `differencePolys`) — the same battle-tested library already used
 * everywhere else in this app for exactly this kind of robustness, not
 * something hand-rolled. Each cell's result is small and almost always
 * hole-free (0 or 1 hole touching a cell boundary is the common case at a
 * sane grid resolution), so plain ear-clipping handles it directly. The
 * rare case — a hole small enough to sit fully inside one cell without
 * touching its edge — still needs bridging, but now only ever between a
 * handful of vertices at a local, safe scale, not the whole pattern at
 * once. */
export function triangulateWithHoles(outer: Polygon, holes: Polygon[]): Polygon[] {
  if (holes.length === 0) return triangulateEarClip(outer)

  const b = bounds(outer)
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY)
  if (span <= 0) return []

  const CELLS_ACROSS = 32
  const cellSize = span / CELLS_ACROSS
  const cols = Math.max(1, Math.ceil((b.maxX - b.minX) / cellSize))
  const rows = Math.max(1, Math.ceil((b.maxY - b.minY) / cellSize))

  const holeBounds = holes.map((h) => bounds(h))
  const triangles: Polygon[] = []

  for (let r = 0; r < rows; r++) {
    const y0 = b.minY + r * cellSize
    const y1 = Math.min(b.maxY, y0 + cellSize)
    for (let c = 0; c < cols; c++) {
      const x0 = b.minX + c * cellSize
      const x1 = Math.min(b.maxX, x0 + cellSize)
      const cellSquare: Polygon = [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ]
      const cellBounds: Bounds = { minX: x0, minY: y0, maxX: x1, maxY: y1 }

      const clippedToOuter = intersectPolys([cellSquare], [outer])
      if (clippedToOuter.length === 0) continue

      const relevantHoles = holes.filter((_, i) => boundsOverlap(holeBounds[i], cellBounds))

      for (const piece of clippedToOuter) {
        if (relevantHoles.length === 0) {
          triangles.push(...triangulateEarClip(piece))
          continue
        }
        const diffed = differencePolys([piece], relevantHoles)
        if (diffed.length === 0) continue
        if (diffed.length === 1) {
          triangles.push(...triangulateEarClip(diffed[0]))
          continue
        }
        // A hole landed fully inside this cell without touching its
        // boundary — Clipper hands back separate solid/hole contours
        // rather than one simple ring. Group each hole with whichever
        // solid contour actually contains it (there can be more than one
        // solid piece per cell after the outer clip), then bridge that
        // small local group — safe at this scale, unlike the whole-
        // pattern case that started this rewrite.
        const pieceWinding = signedArea(piece) >= 0
        const solids = diffed.filter((p) => signedArea(p) >= 0 === pieceWinding)
        const innerHoles = diffed.filter((p) => signedArea(p) >= 0 !== pieceWinding)
        for (const solid of solids) {
          const ownHoles = innerHoles.filter((h) => isInsidePolygon(centroidOf(h), solid))
          triangles.push(...triangulateEarClip(ownHoles.length === 0 ? solid : bridgeHoles(solid, ownHoles)))
        }
      }
    }
  }

  return triangles
}

/** Simple even-odd ray-cast point-in-polygon test — used only to match a
 * small inner-hole contour to its enclosing solid contour within one grid
 * cell, not for anything precision-sensitive. */
function isInsidePolygon(p: Point, poly: Polygon): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y) {
      const xCross = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
      if (p.x < xCross) inside = !inside
    }
  }
  return inside
}
