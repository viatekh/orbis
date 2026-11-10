import { buildShapeOutline } from './shapes'
import { area as polygonArea } from './polygon'
import type { PatternConfig, ShapePrimitive, SurfaceDetailPatternConfig } from './types'

/** Rough cell-count estimate shown next to both the main pattern panel and
 * the surface-detail panel — shared so the two stay consistent rather than
 * one panel guessing with its own hand-rolled formula. Real outline area
 * (works for every shape kind, current and future) rather than a per-kind
 * formula. */
export function estimateCellCount(shape: ShapePrimitive, pattern: PatternConfig | SurfaceDetailPatternConfig): number {
  const shapeArea = polygonArea(buildShapeOutline(shape))
  const patternArea = Math.max(0, shapeArea - pattern.edgeMargin * Math.sqrt(shapeArea) * 2)
  const perLevel = 1 / (pattern.cellSize * pattern.cellSize * 0.87)
  let total = patternArea * perLevel
  let levelArea = patternArea
  for (let d = 0; d < pattern.recursion.depth; d++) {
    const childCellSize = pattern.cellSize * pattern.recursion.childScale ** (d + 1)
    levelArea = levelArea * 0.85
    total += levelArea / (childCellSize * childCellSize * 0.87)
  }
  return Math.round(total * Math.max(1, pattern.symmetryCount))
}
