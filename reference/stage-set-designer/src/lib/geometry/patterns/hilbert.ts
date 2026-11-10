import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import { buildRibbonFromCenterline } from '../ribbon'
import { conformCenterlineToBoundary } from '../boundaryConform'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** The Hilbert curve: the classic recursive space-filling curve. Uses the
 * standard index-to-coordinate ("d2xy") construction to build an order-N
 * curve on an n×n grid, scales it to fit the boundary, and strokes the
 * whole path into one ribbon. */
function hilbertD2xy(order: number, d: number): Point {
  let rx = 0
  let ry = 0
  let x = 0
  let y = 0
  let t = d
  for (let s = 1; s < 1 << order; s *= 2) {
    rx = 1 & (t / 2)
    ry = 1 & (t ^ rx)
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x
        y = s - 1 - y
      }
      ;[x, y] = [y, x]
    }
    x += s * rx
    y += s * ry
    t = Math.floor(t / 4)
  }
  return { x, y }
}

export const generateHilbertCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, cellSize, config } = ctx
  if (cellSize <= 0) return []

  const b = bounds(boundary)
  const span = Math.max(b.maxX - b.minX, b.maxY - b.minY)
  if (span <= 0) return []

  const order = Math.max(2, Math.min(6, 2 + Math.round(config.jitter * 3)))
  const n = 1 << order
  const cellCount = n * n
  const scale = span / n
  const strokeWidth = Math.min(cellSize * 0.4, scale * 0.5)

  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const offset = (n * scale) / 2

  const centerline: Point[] = []
  for (let d = 0; d < cellCount; d++) {
    const p = hilbertD2xy(order, d)
    centerline.push({ x: cx - offset + (p.x + 0.5) * scale, y: cy - offset + (p.y + 0.5) * scale })
  }

  const conformed = conformCenterlineToBoundary(boundary, centerline, scale * 2, 0.4)
  const ribbon = buildRibbonFromCenterline(conformed, () => strokeWidth / 2)
  const cells: Polygon[] = []
  for (const p of intersectPolys([ribbon], [boundary])) if (p.length >= 3) cells.push(p)
  return cells
}
