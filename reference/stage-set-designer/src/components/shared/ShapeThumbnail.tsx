import { buildShapeOutline } from '../../lib/geometry/shapes'
import { boundsOfPolygons } from '../../lib/geometry/polygon'
import { polygonToPathData } from '../../lib/geometry/pathData'
import type { ShapePrimitive } from '../../types'

/** A tiny self-contained SVG render of a shape's raw outline — no pattern,
 * no cut/etch geometry, just the silhouette, framed to its own bounds. */
export function ShapeThumbnail({ shape, size = 56 }: { shape: ShapePrimitive; size?: number }) {
  const outline = buildShapeOutline(shape)
  const b = boundsOfPolygons([outline])
  const w = b.maxX - b.minX || 1
  const h = b.maxY - b.minY || 1
  const pad = Math.max(w, h) * 0.1
  const viewBox = `${b.minX - pad} ${b.minY - pad} ${w + pad * 2} ${h + pad * 2}`

  return (
    <svg width={size} height={size} viewBox={viewBox} className="shrink-0">
      <path d={polygonToPathData(outline)} fill="#a78bfa" fillOpacity={0.85} stroke="#000" strokeWidth={Math.max(w, h) * 0.02} />
    </svg>
  )
}
