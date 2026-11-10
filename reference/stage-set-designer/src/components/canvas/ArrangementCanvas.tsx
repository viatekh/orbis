import { useEffect, useMemo } from 'react'
import { useSvgViewport } from '../../hooks/useSvgViewport'
import { buildLayerSvgDocument } from '../../lib/export/svgDocument'
import { polygonsToPathData } from '../../lib/geometry/pathData'
import { GeometryLayers } from './GeometryLayers'
import type { ArrangementGeometry } from '../../lib/geometry/arrangement'

interface ArrangementCanvasProps {
  geometry: ArrangementGeometry
  recenterKey: string
}

const PADDING_MM = 20

/** Front layers get a slightly lighter fill so the stacking order reads
 * visually, mirroring how the physical assembly will actually occlude. */
function shadeForIndex(index: number, total: number): string {
  if (total <= 1) return '#3f3f46'
  const t = index / (total - 1)
  const lightness = 26 + t * 12 // 26%..38%
  return `hsl(240 4% ${lightness}%)`
}

export function ArrangementCanvas({ geometry, recenterKey }: ArrangementCanvasProps) {
  const b = geometry.bounds
  const widthMm = Math.max(1, b.maxX - b.minX + PADDING_MM * 2)
  const heightMm = Math.max(1, b.maxY - b.minY + PADDING_MM * 2)
  const originX = b.minX - PADDING_MM
  const originY = b.minY - PADDING_MM

  const { svgRef, onWheel, onPointerDown, onPointerMove, onPointerUp, reset } = useSvgViewport({
    x: 0,
    y: 0,
    width: widthMm,
    height: heightMm,
  })

  // Refit whenever the layer SET changes (switching arrangement, or adding/
  // removing a layer — including the very first layer, whose geometry only
  // exists once it's added, unlike a component which always has an
  // outline). Radial-param tweaks on an existing layer intentionally don't
  // refit, so pan/zoom survives while dialing in count/radius.
  const structureKey = `${recenterKey}|${geometry.layers.map((l) => l.layerId).join(',')}`
  useEffect(() => {
    reset({ x: originX, y: originY, width: widthMm, height: heightMm })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey])

  const layerDocs = useMemo(
    () => geometry.layers.filter((l) => l.visible).map((l) => ({ layer: l, doc: buildLayerSvgDocument(l) })),
    [geometry],
  )

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
      {layerDocs.map(({ layer, doc }, i) => {
        const materialPathD =
          layer.mode === 'cut'
            ? `${polygonsToPathData(layer.outline)} ${polygonsToPathData(layer.cutPaths)}`
            : polygonsToPathData(layer.outline)
        return (
          <g key={layer.layerId}>
            <path d={materialPathD} fill={shadeForIndex(i, layerDocs.length)} fillRule="evenodd" stroke="none" />
            <GeometryLayers doc={doc} />
          </g>
        )
      })}
    </svg>
  )
}
