import type { BooleanMode, ShapePrimitive, PatternConfig, EdgeDetailConfig, PlacementGenerator } from '../lib/geometry/types'

export * from '../lib/geometry/types'

/** A cut-through opening at (or offset from) the component's own center —
 * reuses the shape system for the hole's own silhouette, so it can be a
 * circle, star, another freeform outline, anything. The pattern lattice
 * is clipped back from it automatically, so a component with this enabled
 * naturally reads as a frame/ring around an opening — a "Portal." */
export interface CenterHoleConfig {
  enabled: boolean
  shape: ShapePrimitive
  offsetX: number
  offsetY: number
  /** Extra clearance (mm) the pattern lattice is kept back from the hole's
   * edge, beyond the hole itself — a solid collar/frame around the
   * opening, the same idea as the outer pattern's edgeMargin but applied
   * to this inner boundary instead. The hole's own cut-through stays at
   * its defined size regardless of this value. */
  margin: number
  /** A decorative motif banded around the hole's own rim, sitting inside
   * the margin collar — independent of the outer edge's own edgeDetail. */
  edgeDetail: EdgeDetailConfig
}

export interface StageComponent {
  id: string
  name: string
  shape: ShapePrimitive
  pattern: PatternConfig
  centerHole: CenterHoleConfig
  material: { thicknessMm: number; label: string }
  createdAt: string
  updatedAt: string
}

export interface ArrangementLayer {
  id: string
  name: string
  componentId: string
  visible: boolean
  /** How this layer's instances are placed — radial array, grid tiling, or
   * a directly-authored list — see PlacementGenerator (lib/geometry/types).
   * `combineMode`/`depth` stay outside the generator since they apply the
   * same way regardless of which one is chosen. */
  generator: PlacementGenerator
  combineMode: BooleanMode
  /** mm — this layer's own Z-offset from the base, 0 meaning flush with
   * every other layer left at 0. Independent per layer (NOT cumulative —
   * changing one layer's depth never moves any other layer), so it drives
   * both the 3D preview's real world Z (see arrangementMesh.ts) and how
   * tall the auto-generated assembly fins standing out from this layer's
   * silhouette need to be. */
  depth: number
}

export interface Arrangement {
  id: string
  name: string
  layers: ArrangementLayer[]
  createdAt: string
  updatedAt: string
}

export interface Project {
  /** 1 = legacy: ArrangementLayer baked in one radial-only repeat scheme
   * directly (count/radius/... fields on the layer itself). 2 = current:
   * layers carry a `generator` (radial/grid/manual) instead. Old files
   * migrate on import — see lib/migration/backfillProject.ts. */
  schemaVersion: 1 | 2
  id: string
  name: string
  components: StageComponent[]
  arrangements: Arrangement[]
  createdAt: string
  updatedAt: string
}
