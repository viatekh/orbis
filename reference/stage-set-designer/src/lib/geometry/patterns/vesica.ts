import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** A triangular lattice of overlapping circles, sized so each one reaches
 * past its neighbors — the vesica-piscis / "flower of life" grid, where
 * every pair of adjacent circles overlaps in a lens shape. Reuses the same
 * jittered triangular-lattice site placement `voronoi` uses. */
export const generateVesicaCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, config, rng } = ctx
  if (cellSize <= 0) return []

  const b = bounds(boundary)
  const margin = cellSize * 1.5
  const minX = b.minX - margin
  const maxX = b.maxX + margin
  const minY = b.minY - margin
  const maxY = b.maxY + margin

  const rowHeight = (cellSize * Math.sqrt(3)) / 2
  const cols = Math.ceil((maxX - minX) / cellSize) + 3
  const rows = Math.ceil((maxY - minY) / rowHeight) + 3
  const startCol = -Math.ceil(cols / 2)
  const startRow = -Math.ceil(rows / 2)
  const radius = cellSize * 0.62
  const segs = 24
  const jitter = config.jitter

  const cells: Polygon[] = []
  for (let j = startRow; j <= startRow + rows; j++) {
    const rowOffset = ((((j % 2) + 2) % 2) * cellSize) / 2
    const baseY = origin.y + j * rowHeight
    if (baseY < minY - cellSize || baseY > maxY + cellSize) continue
    for (let i = startCol; i <= startCol + cols; i++) {
      const baseX = origin.x + i * cellSize + rowOffset
      if (baseX < minX - cellSize || baseX > maxX + cellSize) continue
      const jx = (rng() * 2 - 1) * jitter * cellSize * 0.15
      const jy = (rng() * 2 - 1) * jitter * cellSize * 0.15
      const cx = baseX + jx
      const cy = baseY + jy

      const circle: Point[] = []
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2
        circle.push({ x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) })
      }
      for (const p of intersectPolys([circle], [boundary])) if (p.length >= 3) cells.push(p)
    }
  }
  return cells
}
