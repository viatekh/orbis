import { computeComponentGeometry } from './pipeline'
import { computePlacementTransforms } from './instanceTransform'
import { buildComponentMesh } from '../export/stlExport'
import type { Tri3 } from '../export/stlExport'
import type { Instance3D } from './types'
import type { Arrangement, StageComponent } from '../../types'

/** Matches ExportPanel's own default emboss height — the 3D preview doesn't
 * expose this as a control (it's a fabrication export detail, not something
 * that needs live tuning to see the assembly's overall shape), so it just
 * needs a reasonable fixed value. */
const DEFAULT_EMBOSS_MM = 1.5

export interface LayerMesh {
  layerId: string
  /** One triangle mesh, built once from the layer's component — every
   * instance below reuses it via a cheap position/rotation, never
   * re-triangulated per instance (triangulation is the expensive part; see
   * triangulate.ts). */
  mesh: Tri3[]
  instances: Instance3D[]
}

export interface ArrangementMeshResult {
  layers: LayerMesh[]
}

/** Pure. The 3D counterpart to `computeArrangementGeometry` (arrangement.ts)
 * — where that one flattens instances into 2D cut/etch outlines via
 * boolean-combine, this one builds a real extruded solid per layer and
 * places copies of it in full 3D via `computePlacementTransforms`, finally
 * consuming the z/rotationX/rotationY instance data that pipeline ignores.
 *
 * `depth` (mm Z-offset from the base) is applied here as each layer's own,
 * independent world Z — NOT a running sum of every layer before it.
 * Cumulative stacking was tried first and rejected: dragging one layer's
 * depth cascaded into moving every layer above it too, which read as "depth
 * moves everything, not just the layer I'm editing" — surprising and hard
 * to reason about with more than two layers. Each layer's depth now only
 * ever moves that one layer. */
export function computeArrangementMesh(arrangement: Arrangement, components: StageComponent[]): ArrangementMeshResult {
  const byId = new Map(components.map((c) => [c.id, c]))
  const layers: LayerMesh[] = []

  for (const layer of arrangement.layers) {
    const component = byId.get(layer.componentId)
    if (!component || !layer.visible) continue

    const geo = computeComponentGeometry(component)
    const mesh = buildComponentMesh(geo, component.material.thicknessMm, DEFAULT_EMBOSS_MM)
    const layerZ = layer.depth ?? 0
    const instances = computePlacementTransforms(layer.generator).map((instance) => ({
      ...instance,
      z: instance.z + layerZ,
    }))

    layers.push({ layerId: layer.id, mesh, instances })
  }

  return { layers }
}
