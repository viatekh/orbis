import { intersectPolys } from '../clipper'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** Phyllotaxis: the golden-angle spiral seed-head arrangement found in
 * sunflowers and pinecones — point i sits at radius c·√i, angle i·137.5°.
 * Each point becomes a small hexagonal cell, scaled up gradually from the
 * center so density stays roughly even outward (the same reason the
 * botanical version packs seeds without gaps or crowding). */
export const generatePhylloCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, patternCenter, patternMaxRadius, cellSize, config } = ctx
  if (cellSize <= 0 || patternMaxRadius <= 0) return []

  const n = Math.max(8, Math.round((Math.PI * patternMaxRadius * patternMaxRadius) / (cellSize * cellSize * 1.4)))
  const c = patternMaxRadius / Math.sqrt(n)
  const motifScale = 0.85 + config.jitter * 0.3

  const cells: Polygon[] = []
  for (let i = 1; i <= n; i++) {
    const r = c * Math.sqrt(i)
    const angle = i * GOLDEN_ANGLE
    const cx = patternCenter.x + r * Math.cos(angle)
    const cy = patternCenter.y + r * Math.sin(angle)
    const motifRadius = Math.min(cellSize * 0.5, c * motifScale * 0.55)

    const poly: Point[] = []
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * Math.PI * 2
      poly.push({ x: cx + motifRadius * Math.cos(a), y: cy + motifRadius * Math.sin(a) })
    }
    for (const p of intersectPolys([poly], [boundary])) if (p.length >= 3) cells.push(p)
  }
  return cells
}
