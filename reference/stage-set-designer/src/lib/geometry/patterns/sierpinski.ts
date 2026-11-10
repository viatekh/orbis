import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Sierpinski gasket: the classic recursive fractal — divide a triangle
 * into 4 by its edge midpoints, cut the middle (inverted) one as a hole,
 * recurse into the 3 corner triangles. Tiled across a triangular lattice
 * (two alternating orientations per row, same trick `voronoi`'s site grid
 * uses) so the fractal covers the whole boundary rather than just one
 * triangle's worth of it. */
export const generateSierpinskiCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, config } = ctx
  if (cellSize <= 0) return []
  const depth = 1 + Math.round(config.jitter * 2) // 1..3 — each level triples the hole count per tile
  // The base lattice triangle is sized so its SMALLEST (deepest) hole is
  // still order-cellSize² — otherwise every hole gets thrown out by the
  // sliver filter, which assumes raw cells are roughly cellSize² already.
  const unitSize = cellSize * 2 ** depth

  const holes: Polygon[] = []
  const mid = (a: Point, c: Point): Point => ({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 })
  const subdivide = (a: Point, b: Point, c: Point, level: number) => {
    if (level <= 0) return
    const ab = mid(a, b)
    const bc = mid(b, c)
    const ca = mid(c, a)
    holes.push([ab, bc, ca])
    subdivide(a, ab, ca, level - 1)
    subdivide(ab, b, bc, level - 1)
    subdivide(ca, bc, c, level - 1)
  }

  const b = bounds(boundary)
  const margin = unitSize * 1.5
  const minX = b.minX - margin
  const maxX = b.maxX + margin
  const minY = b.minY - margin
  const maxY = b.maxY + margin

  const triH = (unitSize * Math.sqrt(3)) / 2
  const cols = Math.ceil((maxX - minX) / unitSize) + 3
  const rows = Math.ceil((maxY - minY) / triH) + 3
  const startCol = -Math.ceil(cols / 2)
  const startRow = -Math.ceil(rows / 2)

  for (let r = startRow; r <= startRow + rows; r++) {
    const rowY = origin.y + r * triH
    if (rowY < minY - triH || rowY > maxY + triH) continue
    for (let c = startCol; c <= startCol + cols; c++) {
      const rowOffset = (((r % 2) + 2) % 2) * (unitSize / 2)
      const baseX = origin.x + c * unitSize + rowOffset
      if (baseX < minX - unitSize || baseX > maxX + unitSize) continue

      // Upward triangle
      subdivide({ x: baseX, y: rowY + triH }, { x: baseX + unitSize, y: rowY + triH }, { x: baseX + unitSize / 2, y: rowY }, depth)
      // Downward triangle (fills the gap the upward ones leave)
      subdivide(
        { x: baseX + unitSize / 2, y: rowY },
        { x: baseX + unitSize * 1.5, y: rowY },
        { x: baseX + unitSize, y: rowY + triH },
        depth,
      )
    }
  }

  const cells: Polygon[] = []
  for (const h of holes) {
    for (const p of intersectPolys([h], [boundary])) if (p.length >= 3) cells.push(p)
  }
  return cells
}
