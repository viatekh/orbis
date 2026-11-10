import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import { buildRibbonFromCenterline } from '../ribbon'
import { conformAngleToBoundary } from '../boundaryConform'
import type { Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Wood-grain / windswept streamlines: a seeded, smoothly-varying angle
 * field (a couple of overlaid sine waves) that a grid of start points is
 * traced through, each producing one long, gently-curved, end-tapered
 * ribbon cell. Unlike the tessellating patterns these are independent
 * strokes that may cross — reads as flowing grain rather than a tiled
 * lattice. Near the outline, the field bends to run parallel to it (the
 * same "grain follows the silhouette" look real wood or a leaf shows at
 * its edge) rather than crossing straight through. */
export const generateFlowCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, cellSize, config, rng } = ctx
  if (cellSize <= 0) return []
  const jitter = config.jitter

  const b = bounds(boundary)
  const spacing = cellSize * 1.3
  const rowWidth = cellSize * 0.4
  const baseAngle = rng() * Math.PI * 2
  const freq = 1 / (cellSize * 3)
  const amp = 0.5 + jitter * 0.9
  const phaseX = rng() * Math.PI * 2
  const phaseY = rng() * Math.PI * 2
  const edgeInfluence = cellSize * 2.5

  const angleAt = (x: number, y: number) => {
    const field = baseAngle + amp * Math.sin(x * freq + phaseX) * Math.cos(y * freq + phaseY)
    return conformAngleToBoundary(boundary, { x, y }, field, edgeInfluence)
  }

  const cols = Math.ceil((b.maxX - b.minX) / spacing) + 2
  const rows = Math.ceil((b.maxY - b.minY) / spacing) + 2
  const steps = 14
  const strideLen = (spacing * 1.15) / steps

  const cells: Polygon[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const startX = b.minX + c * spacing + (r % 2 ? spacing / 2 : 0)
      const startY = b.minY + r * spacing

      const centerline = [{ x: startX, y: startY }]
      let x = startX
      let y = startY
      for (let i = 0; i < steps; i++) {
        const a = angleAt(x, y)
        x += Math.cos(a) * strideLen
        y += Math.sin(a) * strideLen
        centerline.push({ x, y })
      }

      const ribbon = buildRibbonFromCenterline(centerline, (i) => {
        const t = i / steps
        const taper = Math.min(1, t / 0.15, (1 - t) / 0.15)
        return (rowWidth / 2) * taper
      })
      for (const p of intersectPolys([ribbon], [boundary])) if (p.length >= 3) cells.push(p)
    }
  }
  return cells
}
