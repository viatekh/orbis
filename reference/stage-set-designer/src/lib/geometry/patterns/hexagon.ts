import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import type { HexOrientation, Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

function hexCorner(center: Point, size: number, i: number, orientation: HexOrientation): Point {
  const angleDeg = orientation === 'flat' ? 60 * i : 60 * i - 30
  const angleRad = (Math.PI / 180) * angleDeg
  return { x: center.x + size * Math.cos(angleRad), y: center.y + size * Math.sin(angleRad) }
}

function axialToPixel(q: number, r: number, size: number, orientation: HexOrientation): Point {
  if (orientation === 'flat') {
    return { x: size * 1.5 * q, y: size * Math.sqrt(3) * (r + q / 2) }
  }
  return { x: size * Math.sqrt(3) * (q + r / 2), y: size * 1.5 * r }
}

export const generateHexCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, config } = ctx
  if (cellSize <= 0) return []
  const orientation = config.hexOrientation
  const b = bounds(boundary)
  const margin = cellSize * 1.5
  const minX = b.minX - margin
  const maxX = b.maxX + margin
  const minY = b.minY - margin
  const maxY = b.maxY + margin

  const qSpacing = orientation === 'flat' ? cellSize * 1.5 : cellSize * Math.sqrt(3)
  const rSpacing = orientation === 'flat' ? cellSize * Math.sqrt(3) : cellSize * 1.5
  const qRange = Math.ceil((maxX - minX) / qSpacing) + 2
  const rRange = Math.ceil((maxY - minY) / rSpacing) + 2

  const cells: Polygon[] = []

  for (let q = -qRange; q <= qRange; q++) {
    for (let r = -rRange; r <= rRange; r++) {
      const center = axialToPixel(q, r, cellSize, orientation)
      const cx = center.x + origin.x
      const cy = center.y + origin.y
      if (cx < minX || cx > maxX || cy < minY || cy > maxY) continue

      const corners: Polygon = []
      for (let i = 0; i < 6; i++) {
        const p = hexCorner({ x: 0, y: 0 }, cellSize, i, orientation)
        corners.push({ x: cx + p.x, y: cy + p.y })
      }

      const clipped = intersectPolys([corners], [boundary])
      for (const poly of clipped) {
        if (poly.length >= 3) cells.push(poly)
      }
    }
  }

  return cells
}
