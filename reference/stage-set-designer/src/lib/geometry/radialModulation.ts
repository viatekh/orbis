import { centroid, rotatePolygon, scalePolygon, translatePolygon } from './polygon'
import type { Point, Polygon, RadialModulationConfig } from './types'

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Scales the component of each vertex offset that lies ALONG `radialUnit`,
 * leaving the perpendicular (tangential) component untouched — elongates or
 * flattens the cell's own shape along the direction pointing away from the
 * pattern center, without moving the cell or affecting its neighbors. */
function stretchAroundPoint(poly: Polygon, center: Point, radialUnit: Point, stretchAmount: number): Polygon {
  if (stretchAmount === 0) return poly
  const { x: rx, y: ry } = radialUnit
  const tx = -ry
  const ty = rx
  return poly.map((p) => {
    const ox = p.x - center.x
    const oy = p.y - center.y
    const radialComp = ox * rx + oy * ry
    const tangentialComp = ox * tx + oy * ty
    const newRadialComp = radialComp * (1 + stretchAmount)
    return {
      x: center.x + rx * newRadialComp + tx * tangentialComp,
      y: center.y + ry * newRadialComp + ty * tangentialComp,
    }
  })
}

/**
 * Pure. Applies radial effects to a set of pattern cells, in a fixed order
 * that separates "shape distortion" (stretch/size/rotation, around each
 * cell's own centroid) from "field distortion" (pinch/swirl repositioning,
 * around the pattern center):
 *
 *   1. Radial stretch — per-cell anisotropic scale along its own radial axis
 *   2. Size gradient  — uniform scale, shrinks/grows with distance
 *   3. Rotation        — orient-to-center + progressive swirl twist
 *   4. Field remap      — pinch (radial) + swirl (angular) repositioning
 *
 * A cell exactly on the pattern center (dist=0) keeps a stable radial axis
 * of (1,0) since there's no meaningful direction to stretch/orient along.
 */
export function applyRadialModulation(
  cells: Polygon[],
  center: Point,
  maxRadius: number,
  config: RadialModulationConfig,
): Polygon[] {
  if (!config.enabled || maxRadius <= 0) return cells

  return cells.map((cell) => {
    const c = centroid(cell)
    const dx = c.x - center.x
    const dy = c.y - center.y
    const dist = Math.hypot(dx, dy)
    const t = Math.min(1, Math.max(0, dist / maxRadius))
    const angle = Math.atan2(dy, dx)
    const radialUnit: Point = dist > 1e-9 ? { x: dx / dist, y: dy / dist } : { x: 1, y: 0 }

    let poly = cell
    poly = stretchAroundPoint(poly, c, radialUnit, config.stretchAmount)
    poly = scalePolygon(poly, c, lerp(config.sizeStart, config.sizeEnd, t))

    const angleDeg = (angle * 180) / Math.PI
    const rotationDeg = (config.orientToCenter ? angleDeg : 0) + config.swirlAmount * t
    poly = rotatePolygon(poly, c, rotationDeg)

    const newDist = dist * (1 + config.pinchAmount * (1 - t))
    const newAngle = angle + (config.swirlAmount * t * Math.PI) / 180
    const newCx = center.x + newDist * Math.cos(newAngle)
    const newCy = center.y + newDist * Math.sin(newAngle)
    poly = translatePolygon(poly, newCx - c.x, newCy - c.y)

    return poly
  })
}
