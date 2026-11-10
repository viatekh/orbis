// The only file importing d3-delaunay.
import { Delaunay } from 'd3-delaunay'
import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Sites on a triangular lattice, jittered. At jitter=0 this is a perfect
 * triangular lattice, whose Voronoi diagram is a regular hexagonal tiling —
 * so "voronoi" and "hexagon" become a continuum rather than two disjoint
 * pattern types. */
function generateSites(ctx: PatternContext, minX: number, minY: number, maxX: number, maxY: number): Point[] {
  const { origin, cellSize, config, rng } = ctx
  const jitter = config.jitter
  const rowHeight = (cellSize * Math.sqrt(3)) / 2
  const cols = Math.ceil((maxX - minX) / cellSize) + 3
  const rows = Math.ceil((maxY - minY) / rowHeight) + 3
  const startCol = -Math.ceil(cols / 2)
  const startRow = -Math.ceil(rows / 2)

  const sites: Point[] = []
  for (let j = startRow; j <= startRow + rows; j++) {
    const rowOffset = ((((j % 2) + 2) % 2) * cellSize) / 2
    const baseY = origin.y + j * rowHeight
    if (baseY < minY - cellSize || baseY > maxY + cellSize) continue
    for (let i = startCol; i <= startCol + cols; i++) {
      const baseX = origin.x + i * cellSize + rowOffset
      if (baseX < minX - cellSize || baseX > maxX + cellSize) continue
      const jx = (rng() * 2 - 1) * jitter * cellSize * 0.5
      const jy = (rng() * 2 - 1) * jitter * cellSize * 0.5
      sites.push({ x: baseX + jx, y: baseY + jy })
    }
  }
  return sites
}

export const generateVoronoiCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, cellSize } = ctx
  if (cellSize <= 0) return []
  const b = bounds(boundary)
  const margin = cellSize * 1.5
  const minX = b.minX - margin
  const maxX = b.maxX + margin
  const minY = b.minY - margin
  const maxY = b.maxY + margin

  const sites = generateSites(ctx, minX, minY, maxX, maxY)
  if (sites.length === 0) return []

  const delaunay = Delaunay.from(
    sites,
    (p) => p.x,
    (p) => p.y,
  )
  const voronoi = delaunay.voronoi([minX, minY, maxX, maxY])

  const cells: Polygon[] = []
  for (let i = 0; i < sites.length; i++) {
    const cellPolygon = voronoi.cellPolygon(i)
    if (!cellPolygon) continue
    const poly: Polygon = cellPolygon.map(([x, y]) => ({ x, y }))
    const clipped = intersectPolys([poly], [boundary])
    for (const c of clipped) {
      if (c.length >= 3) cells.push(c)
    }
  }
  return cells
}
