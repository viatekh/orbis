import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import { buildRibbonFromCenterline } from '../ribbon'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** A perfect maze (randomized depth-first / "recursive backtracker") on a
 * coarse grid — the standard textbook maze-generation algorithm, not
 * anything LeafSlit-specific. Every visited-cell pair the algorithm links
 * becomes a corridor: a thin ribbon cell connecting their centers (the same
 * "passable connection = cut cell" idea as `circuit`'s traces). Unlinked
 * neighbors stay solid, which is what reads as maze walls once cut. */
export const generateMazeCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, config, rng } = ctx
  if (cellSize <= 0) return []

  const b = bounds(boundary)
  const cols = Math.max(2, Math.ceil((b.maxX - b.minX) / cellSize) + 2)
  const rows = Math.max(2, Math.ceil((b.maxY - b.minY) / cellSize) + 2)
  const startCol = Math.floor((b.minX - origin.x) / cellSize) - 1
  const startRow = Math.floor((b.minY - origin.y) / cellSize) - 1

  const cellAt = (r: number, c: number): Point => ({
    x: origin.x + (startCol + c) * cellSize,
    y: origin.y + (startRow + r) * cellSize,
  })

  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false))
  const links: [Point, Point][] = []

  const neighbors = (r: number, c: number): [number, number][] => {
    const out: [number, number][] = []
    if (r > 0) out.push([r - 1, c])
    if (r < rows - 1) out.push([r + 1, c])
    if (c > 0) out.push([r, c - 1])
    if (c < cols - 1) out.push([r, c + 1])
    return out
  }

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const stack: [number, number][] = [[0, 0]]
  visited[0][0] = true
  while (stack.length > 0) {
    const [r, c] = stack[stack.length - 1]
    const unvisited = shuffle(neighbors(r, c)).filter(([nr, nc]) => !visited[nr][nc])
    if (unvisited.length === 0) {
      stack.pop()
      continue
    }
    const [nr, nc] = unvisited[0]
    visited[nr][nc] = true
    links.push([cellAt(r, c), cellAt(nr, nc)])
    stack.push([nr, nc])
  }

  const corridorWidth = cellSize * (0.28 + config.jitter * 0.12)
  const cells: Polygon[] = []
  for (const [a, c] of links) {
    const ribbon = buildRibbonFromCenterline([a, c], () => corridorWidth / 2)
    for (const p of intersectPolys([ribbon], [boundary])) if (p.length >= 3) cells.push(p)
  }
  return cells
}
