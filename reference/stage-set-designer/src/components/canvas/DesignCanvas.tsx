import { useEffect, useMemo, useState } from 'react'
import { useSvgViewport } from '../../hooks/useSvgViewport'
import { buildSvgDocument } from '../../lib/export/svgDocument'
import { polygonsToPathData } from '../../lib/geometry/pathData'
import { GeometryLayers } from './GeometryLayers'
import { FreeformShapeEditor } from './FreeformShapeEditor'
import type { GeometryResult } from '../../lib/geometry/types'
import type { ShapePrimitive } from '../../types'

interface DesignCanvasProps {
  geometry: GeometryResult
  mode: 'cut' | 'etch'
  recenterKey: string
  /** When the shape is 'freeform' and onShapeChange is provided, draggable
   * control-point handles render directly on the canvas. Omitted entirely
   * for surfaces (like the full arrangement view) where editing a single
   * instance's points wouldn't make sense. */
  shape?: ShapePrimitive
  onShapeChange?: (shape: ShapePrimitive) => void
}

export function DesignCanvas({ geometry, mode, recenterKey, shape, onShapeChange }: DesignCanvasProps) {
  const doc = useMemo(() => buildSvgDocument(geometry), [geometry])
  const { svgRef, onWheel, onPointerDown, onPointerMove, onPointerUp, reset } = useSvgViewport({
    x: 0,
    y: 0,
    width: doc.widthMm,
    height: doc.heightMm,
  })

  // svgRef.current is null during this component's own first render (React
  // attaches refs during commit, after render) — mirrored into state once
  // mounted so FreeformShapeEditor gets a real node to call
  // getScreenCTM() on, instead of being stuck with null until some
  // unrelated re-render happens to occur later.
  const [svgEl, setSvgEl] = useState<SVGSVGElement | null>(null)
  useEffect(() => {
    setSvgEl(svgRef.current)
  }, [svgRef])

  // Recenter only when switching components, not on every parameter tweak —
  // otherwise the user's pan/zoom would reset while adjusting sliders.
  useEffect(() => {
    const [x, y, w, h] = doc.viewBox.split(' ').map(Number)
    reset({ x, y, width: w, height: h })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey])

  // Material fill with holes actually knocked out via fill-rule=evenodd —
  // the outline subpath followed by every cut subpath.
  const materialPathD =
    mode === 'cut'
      ? `${polygonsToPathData(geometry.outline)} ${polygonsToPathData(geometry.cutPaths)}`
      : polygonsToPathData(geometry.outline)

  return (
    <svg
      ref={svgRef}
      className="h-full w-full touch-none bg-neutral-950"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <path d={materialPathD} fill="#3f3f46" fillRule="evenodd" stroke="none" />
      <GeometryLayers doc={doc} />
      {shape?.kind === 'freeform' && onShapeChange && (
        <FreeformShapeEditor
          svg={svgEl}
          points={shape.points}
          onChange={(points) => onShapeChange({ kind: 'freeform', points })}
        />
      )}
    </svg>
  )
}
