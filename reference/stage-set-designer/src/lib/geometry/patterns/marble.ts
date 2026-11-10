import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import { buildRibbonFromCenterline } from '../ribbon'
import { conformAngleToBoundary } from '../boundaryConform'
import type { Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Marbled veining: like `flow`, a grid of streamlines traced through a
 * seeded angle field, but with a second, higher-frequency wave layered on
 * top plus a swirl bias around the pattern center — reads as chaotic
 * marbled/agate veining rather than calm wood grain. */
export const generateMarbleCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, cellSize, config, rng, patternCenter } = ctx
  if (cellSize <= 0) return []
  const jitter = config.jitter

  const b = bounds(boundary)
  const spacing = cellSize * 1.1
  const rowWidth = cellSize * 0.3

  const baseAngle = rng() * Math.PI * 2
  const freqA = 1 / (cellSize * 2.6)
  const freqB = 1 / (cellSize * 0.9)
  const ampA = 0.6 + jitter * 0.7
  const ampB = 0.4 + jitter * 0.9
  const phaseA = rng() * Math.PI * 2
  const phaseB = rng() * Math.PI * 2
  const swirlStrength = 0.4 + jitter * 0.8
  const edgeInfluence = cellSize * 2

  const angleAt = (x: number, y: number) => {
    const dx = x - patternCenter.x
    const dy = y - patternCenter.y
    const swirl = swirlStrength * Math.atan2(dy, dx) * 0.15
    const field =
      baseAngle +
      swirl +
      ampA * Math.sin(x * freqA + phaseA) * Math.cos(y * freqA - phaseA) +
      ampB * Math.sin((x + y) * freqB + phaseB)
    return conformAngleToBoundary(boundary, { x, y }, field, edgeInfluence)
  }

  const cols = Math.ceil((b.maxX - b.minX) / spacing) + 2
  const rows = Math.ceil((b.maxY - b.minY) / spacing) + 2
  const steps = 16
  const strideLen = (spacing * 1.1) / steps

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
        const taper = Math.min(1, t / 0.12, (1 - t) / 0.12)
        return (rowWidth / 2) * taper
      })
      for (const p of intersectPolys([ribbon], [boundary])) if (p.length >= 3) cells.push(p)
    }
  }
  return cells
}
