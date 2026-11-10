import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import { buildRibbonFromCenterline } from '../ribbon'
import { conformCenterlineToBoundary } from '../boundaryConform'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Parallel wavy stripes across the shape's longer axis, all sharing one
 * wave (unlike `flow`'s independent per-streamline field) so they read as
 * a cohesive band of stripes rather than scattered grain — the animal-print
 * "zebra" look. */
export const generateZebraCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, config, rng, patternMaxRadius } = ctx
  if (cellSize <= 0 || patternMaxRadius <= 0) return []
  const jitter = config.jitter

  const b = bounds(boundary)
  const axisAngle = b.maxX - b.minX >= b.maxY - b.minY ? 0 : Math.PI / 2
  const dir: Point = { x: Math.cos(axisAngle), y: Math.sin(axisAngle) }
  const perp: Point = { x: -dir.y, y: dir.x }

  const stripeSpacing = cellSize * 1.15
  const stripeWidth = cellSize * (0.45 + jitter * 0.2)
  const stripeCount = Math.max(2, Math.round((patternMaxRadius * 2.4) / stripeSpacing))
  const halfLen = patternMaxRadius * 1.3
  const waveAmp = cellSize * (0.6 + jitter * 1.4)
  const waveFreq = 1 / (cellSize * (3 + jitter * 4))
  const phase = rng() * Math.PI * 2
  const segs = 20
  const edgeInfluence = cellSize * 2

  const cells: Polygon[] = []
  for (let i = -stripeCount; i <= stripeCount; i++) {
    const offset = i * stripeSpacing
    const centerline: Point[] = []
    for (let s = 0; s <= segs; s++) {
      const t = s / segs
      const along = -halfLen + 2 * halfLen * t
      const wave = waveAmp * Math.sin(along * waveFreq + phase + i * 0.6)
      centerline.push({
        x: origin.x + dir.x * along + perp.x * (offset + wave),
        y: origin.y + dir.y * along + perp.y * (offset + wave),
      })
    }
    // Bends each stripe to run parallel to the outline as it nears it —
    // the same silhouette-hugging effect as flow/marble/vein/manta.
    const conformed = conformCenterlineToBoundary(boundary, centerline, edgeInfluence, 0.5)
    const ribbon = buildRibbonFromCenterline(conformed, (k) => {
      const t = k / segs
      const taper = Math.min(1, t / 0.08, (1 - t) / 0.08)
      return (stripeWidth / 2) * taper
    })
    for (const p of intersectPolys([ribbon], [boundary])) if (p.length >= 3) cells.push(p)
  }

  return cells
}
