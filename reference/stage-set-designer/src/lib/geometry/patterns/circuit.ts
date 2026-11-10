import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import type { Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** PCB-trace-style rectilinear routing: at every node of an orthogonal
 * grid, a horizontal trace to the next node and/or a vertical trace to the
 * node below is randomly present (seeded), plus an occasional square "via"
 * pad at the node itself — a Manhattan network of straight segments and
 * right-angle turns rather than a tessellation. */
export const generateCircuitCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, config, rng } = ctx
  if (cellSize <= 0) return []
  const jitter = config.jitter

  const b = bounds(boundary)
  const margin = cellSize
  const minX = b.minX - margin
  const maxX = b.maxX + margin
  const minY = b.minY - margin
  const maxY = b.maxY + margin

  const traceWidth = cellSize * (0.16 + jitter * 0.12)
  const padSize = cellSize * 0.4
  const density = 0.45 + jitter * 0.3

  const startCol = Math.floor((minX - origin.x) / cellSize)
  const endCol = Math.ceil((maxX - origin.x) / cellSize)
  const startRow = Math.floor((minY - origin.y) / cellSize)
  const endRow = Math.ceil((maxY - origin.y) / cellSize)

  const cells: Polygon[] = []
  const pushClipped = (poly: Polygon) => {
    for (const c of intersectPolys([poly], [boundary])) if (c.length >= 3) cells.push(c)
  }
  const rect = (x0: number, y0: number, x1: number, y1: number): Polygon => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const gx: number = origin.x + col * cellSize
      const gy: number = origin.y + row * cellSize
      const halfTrace = traceWidth / 2

      if (col < endCol && rng() < density) {
        pushClipped(rect(gx - halfTrace, gy - halfTrace, gx + cellSize + halfTrace, gy + halfTrace))
      }
      if (row < endRow && rng() < density) {
        pushClipped(rect(gx - halfTrace, gy - halfTrace, gx + halfTrace, gy + cellSize + halfTrace))
      }
      if (rng() < 0.1) {
        const half = padSize / 2
        pushClipped(rect(gx - half, gy - half, gx + half, gy + half))
      }
    }
  }

  return cells
}
