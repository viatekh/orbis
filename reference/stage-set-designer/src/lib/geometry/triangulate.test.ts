import { describe, expect, it } from 'vitest'
import { triangulateEarClip, triangulateWithHoles } from './triangulate'
import { area, signedArea } from './polygon'
import { computePatternGeometry } from './pipeline'
import { buildShapeOutline } from './shapes'
import { DEFAULT_PATTERN_CONFIG } from './constants'
import type { Polygon } from './types'

function triangleSetArea(triangles: Polygon[]): number {
  return triangles.reduce((sum, t) => sum + area(t), 0)
}

/** The real regression case: a dense voronoi-cut pattern (~dozens of holes,
 * the exact scenario that broke the original nearest-point bridging — two
 * holes' nearest-point bridges readily cross once there are enough of them
 * packed into one outline) triangulated for STL export. If bridges cross,
 * the triangulation silently produces a mangled, self-overlapping mesh
 * whose total triangle area does NOT match the true "outline minus holes"
 * area — that mismatch is what this test actually checks, rather than just
 * "did it throw" or "any NaNs," which the mangled mesh already passed. */
describe('triangulateWithHoles — dense hole regression', () => {
  it('total triangle area matches the true outline-minus-holes area for a ~80-cell voronoi pattern', () => {
    const outline = buildShapeOutline({ kind: 'eye', width: 500, height: 260, rotation: 0 })
    const result = computePatternGeometry(outline, {
      ...DEFAULT_PATTERN_CONFIG,
      kind: 'voronoi',
      cellSize: 30,
      jitter: 0.7,
      edgeMargin: 10,
      strutWidth: 4,
    })
    expect(result.cutPaths.length).toBeGreaterThan(40) // confirms this is genuinely a dense case

    const triangles = triangulateWithHoles(outline, result.cutPaths)
    const triArea = triangleSetArea(triangles)
    const expectedArea = area(outline) - result.cutPaths.reduce((s, p) => s + area(p), 0)

    // A mangled (crossing-bridge) triangulation is wrong by a LOT — order
    // of magnitude off, not a rounding error — so a loose 2% tolerance is
    // still a strict enough check to catch the regression.
    expect(triArea).toBeGreaterThan(expectedArea * 0.98)
    expect(triArea).toBeLessThan(expectedArea * 1.02)
  })

  it('every produced triangle has positive (non-degenerate) area', () => {
    const outline = buildShapeOutline({ kind: 'eye', width: 500, height: 260, rotation: 0 })
    const result = computePatternGeometry(outline, {
      ...DEFAULT_PATTERN_CONFIG,
      kind: 'voronoi',
      cellSize: 25,
      jitter: 0.8,
      edgeMargin: 10,
      strutWidth: 4,
    })
    const triangles = triangulateWithHoles(outline, result.cutPaths)
    expect(triangles.length).toBeGreaterThan(0)
    for (const t of triangles) {
      expect(area(t)).toBeGreaterThan(1e-6)
    }
  })
})

describe('triangulateEarClip — simple polygon', () => {
  it('triangulates a convex hexagon into exactly n-2 triangles covering its full area', () => {
    const hexagon: Polygon = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2
      return { x: 100 * Math.cos(a), y: 100 * Math.sin(a) }
    })
    const triangles = triangulateEarClip(hexagon)
    expect(triangles.length).toBe(4)
    expect(triangleSetArea(triangles)).toBeCloseTo(area(hexagon), 1)
  })

  it('handles a clockwise-wound input the same as counter-clockwise', () => {
    const ccw: Polygon = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    const cw = [...ccw].reverse()
    expect(signedArea(ccw)).toBeGreaterThan(0)
    expect(signedArea(cw)).toBeLessThan(0)
    expect(triangleSetArea(triangulateEarClip(ccw))).toBeCloseTo(triangleSetArea(triangulateEarClip(cw)), 1)
  })
})
