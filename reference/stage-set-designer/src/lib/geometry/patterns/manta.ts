import { intersectPolys } from '../clipper'
import { buildRibbonFromCenterline } from '../ribbon'
import { conformCenterlineToBoundary } from '../boundaryConform'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Manta-ray-gill / fish-skeleton motif: evenly spaced ribs run out from
 * both sides of a central spine, each sweeping forward along a quarter-sine
 * curve and tapering from a wide root to a point — unlike `vein`, ribs
 * don't branch, they're a single even row per side, which reads as gills
 * or a feather's barbs rather than a fractal skeleton. */
export const generateMantaCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, config, rng, patternMaxRadius } = ctx
  if (cellSize <= 0 || patternMaxRadius <= 0) return []
  const jitter = config.jitter

  const baseAngle = rng() * Math.PI * 2
  const dir: Point = { x: Math.cos(baseAngle), y: Math.sin(baseAngle) }
  const perp: Point = { x: -dir.y, y: dir.x }

  const ribSpacing = cellSize * 1.1
  const ribCount = Math.max(2, Math.round((patternMaxRadius * 2.2) / ribSpacing))
  const sweep = 0.4 + jitter * 0.5
  const ribSegments = 10
  const halfWidthBase = cellSize * 0.4
  const edgeInfluence = cellSize * 2.5

  const cells: Polygon[] = []

  for (let i = -ribCount; i <= ribCount; i++) {
    const s = i * ribSpacing
    const spineX = origin.x + dir.x * s
    const spineY = origin.y + dir.y * s

    for (const side of [-1, 1]) {
      const ribLen = patternMaxRadius * (0.65 + rng() * 0.3)
      const centerline: Point[] = []
      for (let k = 0; k <= ribSegments; k++) {
        const t = k / ribSegments
        const along = t * ribLen
        const curve = Math.sin((t * Math.PI) / 2) * ribLen * 0.32 * sweep
        centerline.push({
          x: spineX + perp.x * side * along + dir.x * curve,
          y: spineY + perp.y * side * along + dir.y * curve,
        })
      }
      // Bends the rib to run parallel to the outline as it nears it —
      // gills sweeping to follow a manta's own body edge.
      const conformed = conformCenterlineToBoundary(boundary, centerline, edgeInfluence, 0.5)
      const ribbon = buildRibbonFromCenterline(conformed, (k) => halfWidthBase * (1 - k / ribSegments) ** 0.7)
      for (const p of intersectPolys([ribbon], [boundary])) if (p.length >= 3) cells.push(p)
    }
  }

  return cells
}
