import { intersectPolys } from '../clipper'
import { bounds, scalePolygon } from '../polygon'
import { buildShapeOutline } from '../shapes'
import { computeInstanceTransforms, transformPolygon } from '../instanceTransform'
import type { Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

/** Places copies of an arbitrary base shape (the "motif") on concentric
 * rings around the pattern center — not a tessellation, a repeated stamp.
 * Each ring is laid out with the exact same radial-array math the
 * Arrangement feature uses for whole components (computeInstanceTransforms),
 * just applied at cell density instead of component density. */
export const generateStampCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { cellSize, config, patternCenter, patternMaxRadius } = ctx
  const stampConfig = config.stamp
  if (cellSize <= 0 || patternMaxRadius <= 0) return []

  const rawStamp = buildShapeOutline(stampConfig.shape)
  const stampBounds = bounds(rawStamp)
  const stampSize = Math.max(stampBounds.maxX - stampBounds.minX, stampBounds.maxY - stampBounds.minY)
  if (stampSize <= 0) return []
  const scaleFactor = cellSize / stampSize
  const scaledStamp = scalePolygon(rawStamp, { x: 0, y: 0 }, scaleFactor)

  const ringSpacing = stampConfig.ringSpacing > 0 ? stampConfig.ringSpacing : cellSize

  const cells: Polygon[] = []
  let ringIndex = 0
  for (let r = ringSpacing / 2; r <= patternMaxRadius + ringSpacing; r += ringSpacing) {
    const count = Math.max(1, Math.round((2 * Math.PI * r) / cellSize))
    const stagger = ringIndex % 2 === 1 ? stampConfig.ringStagger : 0
    const transforms = computeInstanceTransforms({
      count,
      radius: r,
      startAngle: stagger,
      arcSpan: 360,
      autoOrient: stampConfig.autoOrient,
      instanceRotation: 0,
      alternateMirror: false,
    })

    for (const t of transforms) {
      const placed = transformPolygon(scaledStamp, {
        ...t,
        x: t.x + patternCenter.x,
        y: t.y + patternCenter.y,
      })
      const clipped = intersectPolys([placed], [ctx.boundary])
      for (const c of clipped) if (c.length >= 3) cells.push(c)
    }
    ringIndex++
  }

  return cells
}
