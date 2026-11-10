import type { SvgDocument } from '../../lib/export/svgDocument'

interface GeometryLayersProps {
  doc: SvgDocument
  /** Cosmetic on-screen stroke width in CSS px (with non-scaling-stroke this
   * ignores viewBox zoom). The exported file always uses the real mm
   * strokeWidthMm from `doc` via serializeSvg — only the preview's line
   * weight is decoupled, since a true 0.1mm hairline is sub-pixel on screen. */
  screenStrokeWidth?: number
}

/** Renders exactly the same layer model (same `d` paths, same layers) that
 * the SVG exporter serializes — one <path> per layer (many M…Z subpaths),
 * not one per cell, so the DOM stays small even with thousands of cells. */
export function GeometryLayers({ doc, screenStrokeWidth = 1.25 }: GeometryLayersProps) {
  return (
    <>
      {doc.layers.map((layer) => (
        <g key={layer.id} data-role={layer.role}>
          <path
            d={layer.d}
            fill="none"
            stroke={layer.stroke}
            strokeWidth={screenStrokeWidth}
            vectorEffect="non-scaling-stroke"
            shapeRendering="geometricPrecision"
          />
        </g>
      ))}
    </>
  )
}
