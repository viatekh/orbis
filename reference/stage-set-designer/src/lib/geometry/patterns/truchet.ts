import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import { buildRibbonFromCenterline } from '../ribbon'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Truchet tiles: a grid of square tiles, each holding a pair of
 * quarter-circle arcs joining the midpoints of adjacent sides, randomly
 * oriented one of two ways per tile — the classic 17th-century tiling
 * technique that reads as flowing maze-like curves once assembled. */
export const generateTruchetCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, rng } = ctx
  if (cellSize <= 0) return []

  const b = bounds(boundary)
  const margin = cellSize * 1.5
  const minX = b.minX - margin
  const maxX = b.maxX + margin
  const minY = b.minY - margin
  const maxY = b.maxY + margin

  const startCol = Math.floor((minX - origin.x) / cellSize)
  const endCol = Math.ceil((maxX - origin.x) / cellSize)
  const startRow = Math.floor((minY - origin.y) / cellSize)
  const endRow = Math.ceil((maxY - origin.y) / cellSize)

  // Wide enough that each arc's raw area clears the sliver filter (which
  // compares against cellSize² and doesn't know a thin curved stroke is
  // legitimately much smaller than its tile).
  const strokeWidth = cellSize * 0.42
  const segs = 8

  const arc = (center: Point, radius: number, fromDeg: number, toDeg: number): Point[] => {
    const pts: Point[] = []
    for (let i = 0; i <= segs; i++) {
      const t = fromDeg + ((toDeg - fromDeg) * i) / segs
      const rad = (t * Math.PI) / 180
      pts.push({ x: center.x + radius * Math.cos(rad), y: center.y + radius * Math.sin(rad) })
    }
    return pts
  }

  const cells: Polygon[] = []
  const pushArc = (center: Point, radius: number, fromDeg: number, toDeg: number) => {
    const ribbon = buildRibbonFromCenterline(arc(center, radius, fromDeg, toDeg), () => strokeWidth / 2)
    for (const p of intersectPolys([ribbon], [boundary])) if (p.length >= 3) cells.push(p)
  }

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const x0 = origin.x + col * cellSize
      const y0 = origin.y + row * cellSize
      const r = cellSize / 2
      const flip = rng() < 0.5
      if (flip) {
        pushArc({ x: x0, y: y0 }, r, 0, 90) // bottom-left corner: joins top-mid <-> left-mid
        pushArc({ x: x0 + cellSize, y: y0 + cellSize }, r, 180, 270) // top-right corner: joins bottom-mid <-> right-mid
      } else {
        pushArc({ x: x0 + cellSize, y: y0 }, r, 90, 180) // bottom-right corner: joins top-mid <-> right-mid
        pushArc({ x: x0, y: y0 + cellSize }, r, 270, 360) // top-left corner: joins bottom-mid <-> left-mid
      }
    }
  }

  return cells
}
