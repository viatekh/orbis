import { intersectPolys } from '../clipper'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Concentric ring bands (annulus segments) around the pattern center, each
 * ring broken into arc segments with a small gap between them — a simpler,
 * motif-free relative of `stamp` (which repeats an arbitrary shape on
 * rings; this repeats plain arc-band pieces). */
export const generateRingCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, patternCenter, patternMaxRadius, cellSize, config } = ctx
  if (cellSize <= 0 || patternMaxRadius <= 0) return []

  const ringSpacing = cellSize * 1.3
  const bandWidth = ringSpacing * (0.55 + config.jitter * 0.2)
  const gapFraction = 0.18

  const cells: Polygon[] = []
  let ringIndex = 0
  for (let rOuter = ringSpacing; rOuter <= patternMaxRadius + ringSpacing; rOuter += ringSpacing) {
    const rInner = Math.max(0, rOuter - bandWidth)
    const circumference = 2 * Math.PI * rOuter
    const segCount = Math.max(3, Math.round(circumference / (cellSize * 1.8)))
    const stagger = ringIndex % 2 === 1 ? Math.PI / segCount : 0

    for (let s = 0; s < segCount; s++) {
      const a0 = stagger + (s / segCount) * Math.PI * 2
      const a1 = a0 + ((1 - gapFraction) * Math.PI * 2) / segCount
      const segs = 6
      const poly: Point[] = []
      for (let i = 0; i <= segs; i++) {
        const a = a0 + ((a1 - a0) * i) / segs
        poly.push({ x: patternCenter.x + rOuter * Math.cos(a), y: patternCenter.y + rOuter * Math.sin(a) })
      }
      for (let i = segs; i >= 0; i--) {
        const a = a0 + ((a1 - a0) * i) / segs
        poly.push({ x: patternCenter.x + rInner * Math.cos(a), y: patternCenter.y + rInner * Math.sin(a) })
      }
      for (const p of intersectPolys([poly], [boundary])) if (p.length >= 3) cells.push(p)
    }
    ringIndex++
  }
  return cells
}
