import { polygonsToPathData } from '../geometry/pathData'
import { boundsOfPolygons } from '../geometry/polygon'
import type { Bounds, GeometryResult } from '../geometry/types'
import type { ArrangementGeometry, LayerGeometry } from '../geometry/arrangement'

const STROKE_WIDTH_MM = 0.1
const OUTLINE_STROKE = '#000000'
const CUT_STROKE = '#0066ff'
const ETCH_STROKE = '#ff0000'
const DETAIL_ETCH_STROKE = '#a3a3a3'
const FIN_STROKE = '#f97316'

export interface SvgLayer {
  id: string
  label: string
  d: string
  role: 'cut' | 'etch' | 'detail' | 'outline' | 'fin'
  stroke: string
  strokeWidthMm: number
}

export interface SvgDocument {
  widthMm: number
  heightMm: number
  viewBox: string
  layers: SvgLayer[]
  metadata: Record<string, string>
}

export interface ExportOptions {
  paddingMm?: number
}

function documentFrame(b: Bounds, paddingMm: number) {
  const widthMm = b.maxX - b.minX + paddingMm * 2
  const heightMm = b.maxY - b.minY + paddingMm * 2
  const originX = b.minX - paddingMm
  const originY = b.minY - paddingMm
  return { widthMm, heightMm, viewBox: `${originX} ${originY} ${widthMm} ${heightMm}` }
}

/** Builds the layer model consumed IDENTICALLY by <GeometryLayers> on screen
 * and by serializeSvg() at export time — this is what makes WYSIWYG
 * structural rather than a discipline to remember. */
export function buildSvgDocument(result: GeometryResult, opts: ExportOptions = {}): SvgDocument {
  const frame = documentFrame(result.bounds, opts.paddingMm ?? 5)

  const layers: SvgLayer[] = [
    { id: 'outline', label: 'Outline', d: polygonsToPathData(result.outline), role: 'outline', stroke: OUTLINE_STROKE, strokeWidthMm: STROKE_WIDTH_MM },
  ]

  if (result.cutPaths.length > 0) {
    layers.push({
      id: 'cut',
      label: 'Cut lines',
      d: polygonsToPathData(result.cutPaths),
      role: 'cut',
      stroke: CUT_STROKE,
      strokeWidthMm: STROKE_WIDTH_MM,
    })
  }

  if (result.etchPaths.length > 0) {
    layers.push({
      id: 'etch',
      label: 'Etch lines',
      d: polygonsToPathData(result.etchPaths),
      role: 'etch',
      stroke: ETCH_STROKE,
      strokeWidthMm: STROKE_WIDTH_MM,
    })
  }

  if (result.detailEtchPaths.length > 0) {
    layers.push({
      id: 'detail-etch',
      label: 'Surface detail',
      d: polygonsToPathData(result.detailEtchPaths),
      role: 'detail',
      stroke: DETAIL_ETCH_STROKE,
      strokeWidthMm: STROKE_WIDTH_MM,
    })
  }

  return { ...frame, layers, metadata: { generator: 'stage-set-designer', createdAt: new Date().toISOString() } }
}

function layerSvgLayers(layer: LayerGeometry, idPrefix: string): SvgLayer[] {
  const layers: SvgLayer[] = [
    {
      id: `${idPrefix}-outline`,
      label: 'Outline',
      d: polygonsToPathData(layer.outline),
      role: 'outline',
      stroke: OUTLINE_STROKE,
      strokeWidthMm: STROKE_WIDTH_MM,
    },
  ]
  if (layer.cutPaths.length > 0) {
    layers.push({
      id: `${idPrefix}-cut`,
      label: 'Cut lines',
      d: polygonsToPathData(layer.cutPaths),
      role: 'cut',
      stroke: CUT_STROKE,
      strokeWidthMm: STROKE_WIDTH_MM,
    })
  }
  if (layer.etchPaths.length > 0) {
    layers.push({
      id: `${idPrefix}-etch`,
      label: 'Etch lines',
      d: polygonsToPathData(layer.etchPaths),
      role: 'etch',
      stroke: ETCH_STROKE,
      strokeWidthMm: STROKE_WIDTH_MM,
    })
  }
  if (layer.detailEtchPaths.length > 0) {
    layers.push({
      id: `${idPrefix}-detail-etch`,
      label: 'Surface detail',
      d: polygonsToPathData(layer.detailEtchPaths),
      role: 'detail',
      stroke: DETAIL_ETCH_STROKE,
      strokeWidthMm: STROKE_WIDTH_MM,
    })
  }
  if (layer.fins.length > 0) {
    layers.push({
      id: `${idPrefix}-fins`,
      label: 'Assembly tabs',
      d: polygonsToPathData(layer.fins),
      role: 'fin',
      stroke: FIN_STROKE,
      strokeWidthMm: STROKE_WIDTH_MM,
    })
  }
  return layers
}

/** One depth layer's SVG — the primary export for fabrication, since each
 * layer is a separate physical sheet cut and assembled with spacers. */
export function buildLayerSvgDocument(layer: LayerGeometry, opts: ExportOptions = {}): SvgDocument {
  const frame = documentFrame(boundsOfPolygons(layer.outline), opts.paddingMm ?? 5)
  return {
    ...frame,
    layers: layerSvgLayers(layer, layer.layerId),
    metadata: { generator: 'stage-set-designer', createdAt: new Date().toISOString() },
  }
}

/** All visible layers combined into one file as separate `<g>` groups —
 * a visual/reference proof of the assembled piece, not a cutting file
 * (layers meant for different physical sheets end up geometrically
 * superimposed here). */
export function buildArrangementSvgDocument(geo: ArrangementGeometry, opts: ExportOptions = {}): SvgDocument {
  const frame = documentFrame(geo.bounds, opts.paddingMm ?? 10)
  const layers = geo.layers.filter((l) => l.visible).flatMap((l) => layerSvgLayers(l, l.layerId))
  return { ...frame, layers, metadata: { generator: 'stage-set-designer', createdAt: new Date().toISOString() } }
}
