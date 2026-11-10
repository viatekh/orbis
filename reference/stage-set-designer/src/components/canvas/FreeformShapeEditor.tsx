import { useRef } from 'react'
import { boundsOfPolygons } from '../../lib/geometry/polygon'
import { autoHandle } from '../shared/shapeDefaults'
import { useDesignerStore } from '../../store/designerStore'
import type { FreeformPoint, Point } from '../../types'

type DragTarget = { index: number; kind: 'anchor' | 'handle' } | null

/** The point at `n-1-i` mirrors `i` across a vertical or horizontal axis
 * through (cx, cy) — flipping the anchor position and negating whichever
 * handle-offset component runs along the flip direction, so the tangent
 * through the partner stays a true mirror image too, not just the point. */
function mirrorFreeformPointAcrossAxis(p: FreeformPoint, axis: 'vertical' | 'horizontal', cx: number, cy: number): FreeformPoint {
  return axis === 'vertical'
    ? { x: 2 * cx - p.x, y: p.y, hx: -p.hx, hy: p.hy }
    : { x: p.x, y: 2 * cy - p.y, hx: p.hx, hy: -p.hy }
}

/** Renders as children of the SAME <svg> the pattern geometry draws into
 * (not an HTML overlay) so the handles sit in the exact same viewBox
 * coordinate space and stay correctly positioned through pan/zoom with no
 * manual screen<->mm conversion needed for rendering — only for
 * interpreting pointer events, via getScreenCTM(). Each anchor gets a
 * second, smaller "pull handle" (LeafSlit-style) — dragging it reshapes
 * the curve's tangent through that anchor without moving the anchor
 * itself, since the handle is stored as an OFFSET (hx, hy) that travels
 * with the anchor automatically. */
export function FreeformShapeEditor({
  svg,
  points,
  onChange,
}: {
  svg: SVGSVGElement | null
  points: FreeformPoint[]
  onChange: (points: FreeformPoint[]) => void
}) {
  const dragging = useRef<DragTarget>(null)
  const mirrorLock = useDesignerStore((s) => s.freeformMirrorLock)

  const toSvgPoint = (clientX: number, clientY: number): Point | null => {
    if (!svg) return null
    const ctm = svg.getScreenCTM()
    if (!ctm) return null
    const pt = svg.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    const local = pt.matrixTransform(ctm.inverse())
    return { x: local.x, y: local.y }
  }

  const bbox = boundsOfPolygons([points])
  const span = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, 1)
  const anchorRadius = Math.min(15, Math.max(3, span * 0.025))
  const handleRadius = anchorRadius * 0.75

  const startDrag = (target: DragTarget) => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    dragging.current = target
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const target = dragging.current
    if (!target) return
    const p = toSvgPoint(e.clientX, e.clientY)
    if (!p) return
    const next = [...points]
    const cur = next[target.index]
    next[target.index] =
      target.kind === 'anchor' ? { ...cur, x: p.x, y: p.y } : { ...cur, hx: p.x - cur.x, hy: p.y - cur.y }

    if (mirrorLock !== 'off') {
      const partnerIndex = next.length - 1 - target.index
      if (partnerIndex !== target.index && next[partnerIndex]) {
        const cx = next.reduce((sum, pt) => sum + pt.x, 0) / next.length
        const cy = next.reduce((sum, pt) => sum + pt.y, 0) / next.length
        next[partnerIndex] = mirrorFreeformPointAcrossAxis(next[target.index], mirrorLock, cx, cy)
      }
    }

    onChange(next)
  }

  const handlePointerUp = () => {
    dragging.current = null
  }

  const removePoint = (index: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    if (points.length <= 3) return
    onChange(points.filter((_, i) => i !== index))
  }

  const insertPointOnNearestEdge = (e: React.MouseEvent) => {
    const p = toSvgPoint(e.clientX, e.clientY)
    if (!p) return
    let bestIndex = 0
    let bestDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const lenSq = dx * dx + dy * dy
      const t = lenSq < 1e-9 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
      const cx = a.x + t * dx
      const cy = a.y + t * dy
      const d = Math.hypot(p.x - cx, p.y - cy)
      if (d < bestDist) {
        bestDist = d
        bestIndex = i + 1
      }
    }
    const positions = points.map((pt) => ({ x: pt.x, y: pt.y }))
    positions.splice(bestIndex, 0, p)
    const { hx, hy } = autoHandle(positions, bestIndex)
    const next = [...points]
    next.splice(bestIndex, 0, { x: p.x, y: p.y, hx, hy })
    onChange(next)
  }

  return (
    <g onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      <polygon
        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="transparent"
        stroke="#a78bfa"
        strokeWidth={anchorRadius * 0.3}
        strokeDasharray={`${anchorRadius * 0.5} ${anchorRadius * 0.4}`}
        strokeOpacity={0.5}
        onDoubleClick={insertPointOnNearestEdge}
        className="cursor-copy"
      />
      {points.map((p, i) => (
        <g key={i}>
          <line
            x1={p.x}
            y1={p.y}
            x2={p.x + p.hx}
            y2={p.y + p.hy}
            stroke="#facc15"
            strokeWidth={anchorRadius * 0.2}
            strokeOpacity={0.7}
          />
          <circle
            cx={p.x + p.hx}
            cy={p.y + p.hy}
            r={handleRadius}
            fill="#facc15"
            stroke="#1e1b2e"
            strokeWidth={handleRadius * 0.25}
            onPointerDown={startDrag({ index: i, kind: 'handle' })}
            className="cursor-grab active:cursor-grabbing"
          />
          <circle
            cx={p.x}
            cy={p.y}
            r={anchorRadius}
            fill="#a78bfa"
            stroke="#1e1b2e"
            strokeWidth={anchorRadius * 0.25}
            onPointerDown={startDrag({ index: i, kind: 'anchor' })}
            onDoubleClick={removePoint(i)}
            className="cursor-grab active:cursor-grabbing"
          />
        </g>
      ))}
    </g>
  )
}
