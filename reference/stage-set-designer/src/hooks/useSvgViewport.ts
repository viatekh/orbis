import { useCallback, useEffect, useRef } from 'react'

export interface Viewport {
  x: number
  y: number
  width: number
  height: number
}

function clampZoomWidth(width: number): number {
  return Math.min(Math.max(width, 20), 20000)
}

/** Pan/zoom that never touches React state — the SVG viewBox is updated
 * directly via a ref inside a rAF loop, so wheel/drag events don't trigger
 * re-renders of a potentially large pattern path. */
export function useSvgViewport(initial: Viewport) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const viewportRef = useRef<Viewport>(initial)
  const rafRef = useRef<number | null>(null)
  const draggingRef = useRef<{ startX: number; startY: number; origin: Viewport } | null>(null)

  const applyViewBox = useCallback(() => {
    const v = viewportRef.current
    svgRef.current?.setAttribute('viewBox', `${v.x} ${v.y} ${v.width} ${v.height}`)
  }, [])

  const scheduleApply = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      applyViewBox()
    })
  }, [applyViewBox])

  const onWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return
      const v = viewportRef.current
      const scale = Math.exp(e.deltaY * 0.001)
      const rect = svg.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      const newWidth = clampZoomWidth(v.width * scale)
      const actualScale = newWidth / v.width
      const newHeight = v.height * actualScale
      const cx = v.x + px * v.width
      const cy = v.y + py * v.height
      viewportRef.current = {
        x: cx - px * newWidth,
        y: cy - py * newHeight,
        width: newWidth,
        height: newHeight,
      }
      scheduleApply()
    },
    [scheduleApply],
  )

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const shouldPan = e.button === 1 || (e.button === 0 && e.altKey)
    if (!shouldPan) return
    e.preventDefault()
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    draggingRef.current = { startX: e.clientX, startY: e.clientY, origin: { ...viewportRef.current } }
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const drag = draggingRef.current
      const svg = svgRef.current
      if (!drag || !svg) return
      const rect = svg.getBoundingClientRect()
      const dxPx = e.clientX - drag.startX
      const dyPx = e.clientY - drag.startY
      const dx = -dxPx * (drag.origin.width / rect.width)
      const dy = -dyPx * (drag.origin.height / rect.height)
      viewportRef.current = { ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy }
      scheduleApply()
    },
    [scheduleApply],
  )

  const onPointerUp = useCallback(() => {
    draggingRef.current = null
  }, [])

  const reset = useCallback(
    (next: Viewport) => {
      viewportRef.current = next
      applyViewBox()
    },
    [applyViewBox],
  )

  useEffect(() => {
    applyViewBox()
  }, [applyViewBox])

  return { svgRef, onWheel, onPointerDown, onPointerMove, onPointerUp, reset }
}
