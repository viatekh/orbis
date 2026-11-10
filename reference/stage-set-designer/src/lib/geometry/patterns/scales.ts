import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Fish-scale / shingle motif: a brick-offset grid of dome-topped, pointed-
 * bottom scales, each taller than its row spacing so it visually overlaps
 * the row below — the classic overlapping-shingle look. */
export const generateScaleCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize } = ctx
  if (cellSize <= 0) return []

  const b = bounds(boundary)
  const margin = cellSize * 1.5
  const minX = b.minX - margin
  const maxX = b.maxX + margin
  const minY = b.minY - margin
  const maxY = b.maxY + margin

  const rowH = cellSize * 0.62
  const w = cellSize
  const halfW = w * 0.46
  const scaleH = rowH * 1.7

  const startRow = Math.floor((minY - origin.y) / rowH)
  const endRow = Math.ceil((maxY - origin.y) / rowH)
  const startCol = Math.floor((minX - origin.x) / w)
  const endCol = Math.ceil((maxX - origin.x) / w)

  const segs = 14
  const cells: Polygon[] = []

  for (let row = startRow; row <= endRow; row++) {
    const offset = (((row % 2) + 2) % 2) * (w / 2)
    for (let col = startCol; col <= endCol; col++) {
      const cx = origin.x + col * w + offset
      const cy = origin.y + row * rowH

      const poly: Point[] = []
      for (let i = 0; i <= segs; i++) {
        const t = i / segs
        const ang = Math.PI * (1 - t)
        poly.push({ x: cx + halfW * Math.cos(ang), y: cy - halfW * Math.sin(ang) })
      }
      poly.push({ x: cx, y: cy - halfW + scaleH })

      for (const c of intersectPolys([poly], [boundary])) if (c.length >= 3) cells.push(c)
    }
  }

  return cells
}
