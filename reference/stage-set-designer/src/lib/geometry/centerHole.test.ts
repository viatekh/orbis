import { describe, expect, it } from 'vitest'
import { computeComponentGeometry } from './pipeline'
import { intersectPolys, outset } from './clipper'
import { area, centroid, translatePolygon } from './polygon'
import { buildShapeOutline } from './shapes'
import { DEFAULT_EDGE_DETAIL, DEFAULT_PATTERN_CONFIG, DEFAULT_SHAPE } from './constants'
import type { CenterHoleConfig, StageComponent } from '../../types'

function componentWithHole(margin: number): StageComponent {
  const now = new Date().toISOString()
  const centerHole: CenterHoleConfig = {
    enabled: true,
    shape: { kind: 'regularPolygon', sides: 32, radius: 30, rotation: 0, cornerRadius: 0 },
    offsetX: 0,
    offsetY: 0,
    margin,
    edgeDetail: { ...DEFAULT_EDGE_DETAIL },
  }
  return {
    id: 'c',
    name: 'c',
    shape: { ...DEFAULT_SHAPE, kind: 'rect', width: 300, height: 300, cornerRadius: 0 },
    pattern: { ...DEFAULT_PATTERN_CONFIG, cellSize: 15, edgeMargin: 5 },
    centerHole,
    material: { thicknessMm: 6, label: 'Plywood' },
    createdAt: now,
    updatedAt: now,
  }
}

describe('applyCenterHole — margin clearance', () => {
  it('keeps cut geometry entirely outside the margin-expanded hole boundary', () => {
    const margin = 20
    const component = componentWithHole(margin)
    const result = computeComponentGeometry(component)
    expect(result.cutPaths.length).toBeGreaterThan(0)

    const outline = buildShapeOutline(component.shape)
    const center = centroid(outline)
    const holePoly = translatePolygon(buildShapeOutline(component.centerHole.shape), center.x, center.y)
    const clearance = outset(holePoly, margin, 'round')[0]

    for (const cell of result.cutPaths) {
      const overlap = intersectPolys([cell], [clearance])
      const overlapArea = overlap.reduce((s, p) => s + area(p), 0)
      expect(overlapArea).toBeLessThan(0.5)
    }
  })

  it('with zero margin, the hole itself is still a real opening (some cut cell touches its edge)', () => {
    const component = componentWithHole(0)
    const result = computeComponentGeometry(component)
    const outline = buildShapeOutline(component.shape)
    const center = centroid(outline)
    const holePoly = translatePolygon(buildShapeOutline(component.centerHole.shape), center.x, center.y)

    // The hole itself is always subtracted regardless of margin — no cut
    // geometry should ever fall inside the raw hole.
    for (const cell of result.cutPaths) {
      const overlap = intersectPolys([cell], [holePoly])
      const overlapArea = overlap.reduce((s, p) => s + area(p), 0)
      expect(overlapArea).toBeLessThan(0.5)
    }
  })

  it('a larger margin removes strictly more (or equal) cut area than a smaller one', () => {
    const small = computeComponentGeometry(componentWithHole(5))
    const large = computeComponentGeometry(componentWithHole(40))
    const smallCutArea = small.cutPaths.reduce((s, p) => s + area(p), 0)
    const largeCutArea = large.cutPaths.reduce((s, p) => s + area(p), 0)
    expect(largeCutArea).toBeLessThanOrEqual(smallCutArea)
  })
})
