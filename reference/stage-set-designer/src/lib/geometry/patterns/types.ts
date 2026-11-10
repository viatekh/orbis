import type { Point, Polygon, PatternConfig } from '../types'
import type { Rng } from '../random'

export interface PatternContext {
  boundary: Polygon
  origin: Point
  cellSize: number
  level: number
  rng: Rng
  config: PatternConfig
  /** Fixed reference point/radius for radial effects (size gradient, orient-
   * to-center, swirl, stamp rings) — the whole pattern's center, NOT the
   * per-level lattice anchor (`origin`), so effects stay anchored to the
   * overall shape even as recursion nests into smaller sub-boundaries. */
  patternCenter: Point
  patternMaxRadius: number
}

/** Returns RAW (un-inset) cells, already clipped to ctx.boundary. Pure. */
export type PatternGenerator = (ctx: PatternContext) => Polygon[]
