import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import type { Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Ladder motif: long horizontal rails at even intervals, connected by
 * short perpendicular rungs at intervals along their length — two rail
 * spacings' worth of rung between each pair of rails. */
export const generateRungCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, config, rng } = ctx
  if (cellSize <= 0) return []
  const jitter = config.jitter

  const b = bounds(boundary)
  const margin = cellSize * 1.5
  const minX = b.minX - margin
  const maxX = b.maxX + margin
  const minY = b.minY - margin
  const maxY = b.maxY + margin

  const railSpacing = cellSize * 1.4
  const railWidth = cellSize * 0.26
  const rungWidth = cellSize * 0.22
  const rungSpacing = cellSize

  const startRow = Math.floor((minY - origin.y) / railSpacing)
  const endRow = Math.ceil((maxY - origin.y) / railSpacing)
  const startCol = Math.floor((minX - origin.x) / rungSpacing)
  const endCol = Math.ceil((maxX - origin.x) / rungSpacing)

  const cells: Polygon[] = []
  const pushClipped = (poly: Polygon) => {
    for (const c of intersectPolys([poly], [boundary])) if (c.length >= 3) cells.push(c)
  }

  for (let row = startRow; row <= endRow; row++) {
    const ry = origin.y + row * railSpacing
    pushClipped([
      { x: minX, y: ry - railWidth / 2 },
      { x: maxX, y: ry - railWidth / 2 },
      { x: maxX, y: ry + railWidth / 2 },
      { x: minX, y: ry + railWidth / 2 },
    ])

    if (row < endRow) {
      for (let col = startCol; col <= endCol; col++) {
        const jitterX = (rng() - 0.5) * jitter * rungSpacing * 0.3
        const rx = origin.x + col * rungSpacing + jitterX
        pushClipped([
          { x: rx - rungWidth / 2, y: ry - railWidth / 2 },
          { x: rx + rungWidth / 2, y: ry - railWidth / 2 },
          { x: rx + rungWidth / 2, y: ry + railSpacing + railWidth / 2 },
          { x: rx - rungWidth / 2, y: ry + railSpacing + railWidth / 2 },
        ])
      }
    }
  }

  return cells
}
