import { describe, expect, it } from 'vitest'
import { scaleCenterHole, scalePatternForShape, scaleShapePrimitive, shapeScaleRatio } from './patternScale'
import { DEFAULT_CENTER_HOLE_SHAPE, DEFAULT_EDGE_DETAIL, DEFAULT_PATTERN_CONFIG } from './constants'

describe('shapeScaleRatio', () => {
  it('is 1 for an unchanged shape', () => {
    const shape = { kind: 'rect' as const, width: 300, height: 200, cornerRadius: 0 }
    expect(shapeScaleRatio(shape, shape)).toBeCloseTo(1)
  })

  it('is 2 when a rect doubles both dimensions (area 4x, linear 2x)', () => {
    const before = { kind: 'rect' as const, width: 300, height: 200, cornerRadius: 0 }
    const after = { kind: 'rect' as const, width: 600, height: 400, cornerRadius: 0 }
    expect(shapeScaleRatio(before, after)).toBeCloseTo(2)
  })

  it('is 0.5 when a rect shrinks to a quarter of its area', () => {
    const before = { kind: 'rect' as const, width: 400, height: 400, cornerRadius: 0 }
    const after = { kind: 'rect' as const, width: 200, height: 200, cornerRadius: 0 }
    expect(shapeScaleRatio(before, after)).toBeCloseTo(0.5)
  })

  it('works across a shape kind change via area', () => {
    const before = { kind: 'rect' as const, width: 200, height: 200, cornerRadius: 0 }
    const after = { kind: 'regularPolygon' as const, sides: 6, radius: 200, rotation: 0, cornerRadius: 0 }
    const ratio = shapeScaleRatio(before, after)
    expect(ratio).toBeGreaterThan(0)
    expect(Number.isFinite(ratio)).toBe(true)
  })
})

describe('scaleShapePrimitive', () => {
  it('scales a rect’s width, height, and corner radius linearly', () => {
    const shape = { kind: 'rect' as const, width: 100, height: 50, cornerRadius: 4 }
    const scaled = scaleShapePrimitive(shape, 3)
    expect(scaled).toEqual({ kind: 'rect', width: 300, height: 150, cornerRadius: 12 })
  })

  it('scales a regularPolygon’s radius and corner radius, leaves sides/rotation untouched', () => {
    const shape = { kind: 'regularPolygon' as const, sides: 6, radius: 100, rotation: 15, cornerRadius: 2 }
    const scaled = scaleShapePrimitive(shape, 0.5)
    expect(scaled).toEqual({ kind: 'regularPolygon', sides: 6, radius: 50, rotation: 15, cornerRadius: 1 })
  })

  it('scales every freeform point and its pull-handle offset', () => {
    const shape = { kind: 'freeform' as const, points: [{ x: 10, y: 20, hx: 1, hy: -1 }] }
    const scaled = scaleShapePrimitive(shape, 2)
    expect(scaled).toEqual({ kind: 'freeform', points: [{ x: 20, y: 40, hx: 2, hy: -2 }] })
  })
})

describe('scalePatternForShape', () => {
  it('is a no-op at ratio 1', () => {
    const scaled = scalePatternForShape(DEFAULT_PATTERN_CONFIG, 1)
    expect(scaled).toBe(DEFAULT_PATTERN_CONFIG)
  })

  it('scales cell size, edge margin, and explode amount linearly', () => {
    const pattern = { ...DEFAULT_PATTERN_CONFIG, cellSize: 25, edgeMargin: 10, explodeAmount: 15 }
    const scaled = scalePatternForShape(pattern, 2)
    expect(scaled.cellSize).toBeCloseTo(50)
    expect(scaled.edgeMargin).toBeCloseTo(20)
    expect(scaled.explodeAmount).toBeCloseTo(30)
  })

  it('scales strut width but clamps it back up to minStrutWidth', () => {
    const pattern = { ...DEFAULT_PATTERN_CONFIG, strutWidth: 3, minStrutWidth: 1.5 }
    const grown = scalePatternForShape(pattern, 2)
    expect(grown.strutWidth).toBeCloseTo(6)

    const shrunk = scalePatternForShape(pattern, 0.1) // 3 * 0.1 = 0.3, below the 1.5 floor
    expect(shrunk.strutWidth).toBeCloseTo(1.5)
  })

  it('leaves kerf and minStrutWidth untouched — they are fabrication constants, not design size', () => {
    const pattern = { ...DEFAULT_PATTERN_CONFIG, kerf: 0.15, minStrutWidth: 1.5 }
    const scaled = scalePatternForShape(pattern, 3)
    expect(scaled.kerf).toBe(0.15)
    expect(scaled.minStrutWidth).toBe(1.5)
  })

  it('leaves dimensionless fields untouched (jitter, seed, counts, radial modulation ratios)', () => {
    const pattern = {
      ...DEFAULT_PATTERN_CONFIG,
      jitter: 0.6,
      seed: 42,
      symmetryCount: 6,
      radialModulation: { ...DEFAULT_PATTERN_CONFIG.radialModulation, enabled: true, sizeStart: 0.8, swirlAmount: 30 },
    }
    const scaled = scalePatternForShape(pattern, 2)
    expect(scaled.jitter).toBe(0.6)
    expect(scaled.seed).toBe(42)
    expect(scaled.symmetryCount).toBe(6)
    expect(scaled.radialModulation).toEqual(pattern.radialModulation)
  })

  it('scales minCellArea by k² since it is an area threshold', () => {
    const pattern = { ...DEFAULT_PATTERN_CONFIG, recursion: { ...DEFAULT_PATTERN_CONFIG.recursion, minCellArea: 40 } }
    const scaled = scalePatternForShape(pattern, 2)
    expect(scaled.recursion.minCellArea).toBeCloseTo(160)
  })

  it('scales the stamp motif shape and ring spacing', () => {
    const pattern = {
      ...DEFAULT_PATTERN_CONFIG,
      stamp: {
        ...DEFAULT_PATTERN_CONFIG.stamp,
        ringSpacing: 20,
        shape: { kind: 'regularPolygon' as const, sides: 6, radius: 10, rotation: 0, cornerRadius: 0 },
      },
    }
    const scaled = scalePatternForShape(pattern, 2)
    expect(scaled.stamp.ringSpacing).toBeCloseTo(40)
    expect(scaled.stamp.shape).toMatchObject({ radius: 20 })
  })

  it('recursively scales the surface-detail pattern the same way, clamped to its own minStrutWidth', () => {
    const pattern = {
      ...DEFAULT_PATTERN_CONFIG,
      surfaceDetail: {
        enabled: true,
        pattern: { ...DEFAULT_PATTERN_CONFIG.surfaceDetail.pattern, cellSize: 8, edgeMargin: 5, strutWidth: 1, minStrutWidth: 0.5 },
      },
    }
    const scaled = scalePatternForShape(pattern, 3)
    expect(scaled.surfaceDetail.pattern.cellSize).toBeCloseTo(24)
    expect(scaled.surfaceDetail.pattern.edgeMargin).toBeCloseTo(15)
    expect(scaled.surfaceDetail.pattern.strutWidth).toBeCloseTo(3)
  })

  it("scales the outer edgeDetail's spacing/size/offset, leaves its kind/mode untouched", () => {
    const pattern = {
      ...DEFAULT_PATTERN_CONFIG,
      edgeDetail: { ...DEFAULT_EDGE_DETAIL, enabled: true, kind: 'dots' as const, spacing: 10, size: 4, offset: 2 },
    }
    const scaled = scalePatternForShape(pattern, 2.5)
    expect(scaled.edgeDetail.spacing).toBeCloseTo(25)
    expect(scaled.edgeDetail.size).toBeCloseTo(10)
    expect(scaled.edgeDetail.offset).toBeCloseTo(5)
    expect(scaled.edgeDetail.kind).toBe('dots')
    expect(scaled.edgeDetail.enabled).toBe(true)
  })
})

describe('scaleCenterHole', () => {
  const centerHole = {
    enabled: true,
    shape: { ...DEFAULT_CENTER_HOLE_SHAPE },
    offsetX: 10,
    offsetY: -5,
    margin: 3,
    edgeDetail: { ...DEFAULT_EDGE_DETAIL, spacing: 8, size: 2, offset: 1 },
  }

  it('is a no-op at ratio 1', () => {
    expect(scaleCenterHole(centerHole, 1)).toBe(centerHole)
  })

  it('scales offsetX/offsetY/margin linearly, leaves enabled untouched', () => {
    const scaled = scaleCenterHole(centerHole, 4)
    expect(scaled.offsetX).toBeCloseTo(40)
    expect(scaled.offsetY).toBeCloseTo(-20)
    expect(scaled.margin).toBeCloseTo(12)
    expect(scaled.enabled).toBe(true)
  })

  it("scales its own shape and rim edgeDetail", () => {
    const scaled = scaleCenterHole(centerHole, 2)
    expect(scaled.shape).toEqual(scaleShapePrimitive(centerHole.shape, 2))
    expect(scaled.edgeDetail.spacing).toBeCloseTo(16)
    expect(scaled.edgeDetail.size).toBeCloseTo(4)
    expect(scaled.edgeDetail.offset).toBeCloseTo(2)
  })
})
