import { computeComponentGeometry } from './pipeline'
import { combineInstances } from './booleanCombine'
import { bounds, mergeBounds } from './polygon'
import { computePlacementTransforms, projectToPlane, transformPolygons } from './instanceTransform'
import { buildLayerFins } from './fins'
import type { Bounds, PatternMode, Polygon } from './types'
import type { Arrangement, StageComponent } from '../../types'

export type { InstanceTransform } from './instanceTransform'
export { computeInstanceTransforms, computePlacementTransforms, transformPolygon, transformPolygons } from './instanceTransform'

export interface LayerGeometry {
  layerId: string
  visible: boolean
  mode: PatternMode
  outline: Polygon[]
  cutPaths: Polygon[]
  etchPaths: Polygon[]
  detailEtchPaths: Polygon[]
  /** Assembly tabs standing out from this layer's own outer silhouette,
   * `depth` mm tall — see fins.ts. Empty when depth is 0 (flush/coplanar,
   * the default — every layer before this feature existed behaves exactly
   * as before). */
  fins: Polygon[]
}

export interface ArrangementGeometry {
  layers: LayerGeometry[]
  bounds: Bounds
}

const EMPTY_BOUNDS: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }

/** Pure. Computes each referenced component's pattern geometry ONCE per
 * layer (not once per instance) and fans it out to every instance via cheap
 * affine transforms — the expensive Voronoi/hex/fractal work never repeats. */
export function computeArrangementGeometry(arrangement: Arrangement, components: StageComponent[]): ArrangementGeometry {
  const byId = new Map(components.map((c) => [c.id, c]))
  const layers: LayerGeometry[] = []
  let combinedBounds: Bounds | null = null

  for (const layer of arrangement.layers) {
    const component = byId.get(layer.componentId)
    if (!component) continue

    let outline: Polygon[] = []
    let cutPaths: Polygon[] = []
    let etchPaths: Polygon[] = []
    let detailEtchPaths: Polygon[] = []
    let fins: Polygon[] = []

    if (layer.visible) {
      const geo = computeComponentGeometry(component)
      const instances = computePlacementTransforms(layer.generator)
      const placedInstances = instances.map((instance) => {
        const t = projectToPlane(instance)
        return {
          outline: transformPolygons(geo.outline, t),
          cutPaths: transformPolygons(geo.cutPaths, t),
          etchPaths: transformPolygons(geo.etchPaths, t),
          detailEtchPaths: transformPolygons(geo.detailEtchPaths, t),
        }
      })

      const combined = combineInstances(layer.combineMode, placedInstances, component.pattern.mode === 'etch')
      outline = combined.outline
      cutPaths = combined.cutPaths
      etchPaths = combined.etchPaths
      detailEtchPaths = combined.detailEtchPaths
      fins = buildLayerFins(outline, layer.depth ?? 0)

      for (const poly of outline) combinedBounds = mergeBounds(combinedBounds, bounds(poly))
    }

    layers.push({
      layerId: layer.id,
      visible: layer.visible,
      mode: component.pattern.mode,
      outline,
      cutPaths,
      etchPaths,
      detailEtchPaths,
      fins,
    })
  }

  return { layers, bounds: combinedBounds ?? EMPTY_BOUNDS }
}
