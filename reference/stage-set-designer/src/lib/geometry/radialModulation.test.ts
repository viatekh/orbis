import { describe, expect, it } from 'vitest'
import { applyRadialModulation } from './radialModulation'
import { area, centroid } from './polygon'
import { DEFAULT_PATTERN_CONFIG } from './constants'
import type { Polygon, RadialModulationConfig } from './types'

const CENTER = { x: 0, y: 0 }
const MAX_RADIUS = 100

function config(overrides: Partial<RadialModulationConfig> = {}): RadialModulationConfig {
  return { ...DEFAULT_PATTERN_CONFIG.radialModulation, enabled: true, ...overrides }
}

describe('applyRadialModulation', () => {
  it('is a no-op when disabled, regardless of other params', () => {
    const cell: Polygon = [
      { x: 40, y: 0 },
      { x: 60, y: 0 },
      { x: 60, y: 20 },
      { x: 40, y: 20 },
    ]
    const result = applyRadialModulation(
      [cell],
      CENTER,
      MAX_RADIUS,
      config({ enabled: false, sizeStart: 0.5, sizeEnd: 2, orientToCenter: true, swirlAmount: 45, pinchAmount: 0.5, stretchAmount: 0.5 }),
    )
    expect(result[0]).toEqual(cell)
  })

  it('scales a cell around its own centroid via the size gradient', () => {
    const cell: Polygon = [
      { x: 90, y: -10 },
      { x: 110, y: -10 },
      { x: 110, y: 10 },
      { x: 90, y: 10 },
    ]
    const [result] = applyRadialModulation([cell], CENTER, MAX_RADIUS, config({ sizeStart: 1, sizeEnd: 0.5 }))
    expect(area(result)).toBeCloseTo(area(cell) * 0.25) // scale 0.5 -> area * 0.5^2
    const c = centroid(result)
    expect(c.x).toBeCloseTo(100)
    expect(c.y).toBeCloseTo(0)
  })

  it('orient-to-center rotates a cell around its own centroid to face outward', () => {
    // Centroid sits directly above the pattern center (angle = 90deg).
    const cell: Polygon = [
      { x: -5, y: 95 },
      { x: 5, y: 95 },
      { x: 5, y: 105 },
      { x: -5, y: 105 },
    ]
    const [result] = applyRadialModulation([cell], CENTER, MAX_RADIUS, config({ orientToCenter: true }))
    // Rotating (-5,-5) offset by 90deg around centroid (0,100) -> (5,-5) -> (5,95)
    expect(result[0].x).toBeCloseTo(5)
    expect(result[0].y).toBeCloseTo(95)
  })

  it('swirl both rotates the cell and repositions it angularly', () => {
    const cell: Polygon = [
      { x: 90, y: -10 },
      { x: 110, y: -10 },
      { x: 110, y: 10 },
      { x: 90, y: 10 },
    ]
    const [result] = applyRadialModulation([cell], CENTER, MAX_RADIUS, config({ swirlAmount: 90 }))
    const c = centroid(result)
    // t=1 at maxRadius, so the full 90deg swirl applies: centroid moves from
    // angle 0 (100,0) to angle 90 (0,100).
    expect(c.x).toBeCloseTo(0, 4)
    expect(c.y).toBeCloseTo(100)
  })

  it('pinch changes centroid distance from center without altering the cell shape', () => {
    const cell: Polygon = [
      { x: 40, y: -10 },
      { x: 60, y: -10 },
      { x: 60, y: 10 },
      { x: 40, y: 10 },
    ]
    const [result] = applyRadialModulation([cell], CENTER, MAX_RADIUS, config({ pinchAmount: 0.4 }))
    const c = centroid(result)
    // dist=50, t=0.5 -> newDist = 50*(1+0.4*0.5) = 60
    expect(c.x).toBeCloseTo(60)
    expect(c.y).toBeCloseTo(0)
    // shape itself untouched — edge vector between two vertices preserved
    const edge = { x: result[1].x - result[0].x, y: result[1].y - result[0].y }
    expect(edge.x).toBeCloseTo(20)
    expect(edge.y).toBeCloseTo(0)
  })

  it('radial stretch elongates only the radially-aligned vertices, not tangential ones', () => {
    // Diamond centered at (100,0): left/right vertices are radial, top/bottom are tangential.
    const cell: Polygon = [
      { x: 90, y: 0 },
      { x: 100, y: 10 },
      { x: 110, y: 0 },
      { x: 100, y: -10 },
    ]
    const [result] = applyRadialModulation([cell], CENTER, MAX_RADIUS, config({ stretchAmount: 0.5 }))
    expect(result[0]).toEqual({ x: 85, y: 0 }) // left, radial: -10 -> -15
    expect(result[2]).toEqual({ x: 115, y: 0 }) // right, radial: +10 -> +15
    expect(result[1].x).toBeCloseTo(100) // top, tangential: unchanged
    expect(result[1].y).toBeCloseTo(10)
    expect(result[3].x).toBeCloseTo(100) // bottom, tangential: unchanged
    expect(result[3].y).toBeCloseTo(-10)
  })

  it('is a no-op when maxRadius is zero (degenerate pattern)', () => {
    const cell: Polygon = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]
    const result = applyRadialModulation([cell], CENTER, 0, config({ sizeEnd: 0.2 }))
    expect(result[0]).toEqual(cell)
  })
})
