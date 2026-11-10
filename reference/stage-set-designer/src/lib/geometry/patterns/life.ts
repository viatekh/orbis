import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import type { Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Conway's Game of Life: a random ~35%-alive grid, evolved a handful of
 * generations under the standard B3/S23 rule (a cell with exactly 3
 * neighbors is born, one with 2 or 3 survives, otherwise it dies) — the
 * settled generation's live cells become square pattern cells. */
export const generateLifeCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, rng } = ctx
  if (cellSize <= 0) return []

  const b = bounds(boundary)
  const margin = cellSize * 2
  const minX = b.minX - margin
  const maxX = b.maxX + margin
  const minY = b.minY - margin
  const maxY = b.maxY + margin
  const startCol = Math.floor((minX - origin.x) / cellSize)
  const endCol = Math.ceil((maxX - origin.x) / cellSize)
  const startRow = Math.floor((minY - origin.y) / cellSize)
  const endRow = Math.ceil((maxY - origin.y) / cellSize)
  const cols = endCol - startCol + 1
  const rows = endRow - startRow + 1
  if (cols <= 0 || rows <= 0 || cols * rows > 20000) return []

  let grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng() < 0.35))

  const alive = (g: boolean[][], r: number, c: number): number => (r >= 0 && r < rows && c >= 0 && c < cols && g[r][c] ? 1 : 0)

  for (let gen = 0; gen < 3; gen++) {
    const next = Array.from({ length: rows }, () => new Array(cols).fill(false))
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let n = 0
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue
            n += alive(grid, r + dr, c + dc)
          }
        }
        next[r][c] = grid[r][c] ? n === 2 || n === 3 : n === 3
      }
    }
    grid = next
  }

  const cells: Polygon[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) continue
      const x0 = origin.x + (startCol + c) * cellSize
      const y0 = origin.y + (startRow + r) * cellSize
      const rect: Polygon = [
        { x: x0, y: y0 },
        { x: x0 + cellSize, y: y0 },
        { x: x0 + cellSize, y: y0 + cellSize },
        { x: x0, y: y0 + cellSize },
      ]
      for (const p of intersectPolys([rect], [boundary])) if (p.length >= 3) cells.push(p)
    }
  }
  return cells
}
