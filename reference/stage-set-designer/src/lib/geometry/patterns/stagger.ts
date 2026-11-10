import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import type { Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** A brick-bond grid: rectangular cells, each row offset by half a cell
 * from the one above — simpler and non-overlapping compared to `scales`
 * (which staggers rounded shingle shapes and lets them overlap). */
export const generateStaggerCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, config } = ctx
  if (cellSize <= 0) return []

  const b = bounds(boundary)
  const margin = cellSize * 1.5
  const minX = b.minX - margin
  const maxX = b.maxX + margin
  const minY = b.minY - margin
  const maxY = b.maxY + margin

  const rowH = cellSize * (0.7 + config.jitter * 0.3)
  const startRow = Math.floor((minY - origin.y) / rowH)
  const endRow = Math.ceil((maxY - origin.y) / rowH)
  const startCol = Math.floor((minX - origin.x) / cellSize)
  const endCol = Math.ceil((maxX - origin.x) / cellSize)

  const cells: Polygon[] = []
  for (let row = startRow; row <= endRow; row++) {
    const offset = (((row % 2) + 2) % 2) * (cellSize / 2)
    for (let col = startCol; col <= endCol; col++) {
      const x0 = origin.x + col * cellSize + offset
      const y0 = origin.y + row * rowH
      const rect: Polygon = [
        { x: x0, y: y0 },
        { x: x0 + cellSize, y: y0 },
        { x: x0 + cellSize, y: y0 + rowH },
        { x: x0, y: y0 + rowH },
      ]
      for (const p of intersectPolys([rect], [boundary])) if (p.length >= 3) cells.push(p)
    }
  }
  return cells
}
