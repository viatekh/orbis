import { describe, expect, it } from 'vitest'
import { convertToFreeform } from './shapeDefaults'
import { buildShapeOutline } from '../../lib/geometry/shapes'
import { area } from '../../lib/geometry/polygon'
import type { ShapePrimitive } from '../../types'

describe('convertToFreeform', () => {
  it('uses a coarse shape\'s own vertices directly rather than resampling up', () => {
    const rect: ShapePrimitive = { kind: 'rect', width: 300, height: 200, cornerRadius: 0 }
    const points = convertToFreeform(rect, 24)
    expect(points.length).toBe(4)
  })

  it('resamples a smooth shape down to the target point count', () => {
    const eye: ShapePrimitive = { kind: 'eye', width: 300, height: 140, rotation: 0 }
    expect(buildShapeOutline(eye).length).toBeGreaterThan(24)
    const points = convertToFreeform(eye, 24)
    expect(points.length).toBe(24)
  })

  it('produces a closed loop with no duplicate-degenerate consecutive points', () => {
    const star: ShapePrimitive = { kind: 'star', points: 5, radius: 150, innerRadiusRatio: 0.5, rotation: -90, cornerRadius: 0 }
    const points = convertToFreeform(star, 24)
    for (let i = 0; i < points.length; i++) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(0.01)
    }
  })

  it('approximates the original silhouette reasonably closely (area within 15%)', () => {
    const blob: ShapePrimitive = { kind: 'blob', radius: 150, complexity: 4, irregularity: 0.3, seed: 3 }
    const originalArea = area(buildShapeOutline(blob))
    const points = convertToFreeform(blob, 32)
    const converted = buildShapeOutline({ kind: 'freeform', points })
    const convertedArea = area(converted)
    expect(convertedArea).toBeGreaterThan(originalArea * 0.85)
    expect(convertedArea).toBeLessThan(originalArea * 1.15)
  })

  it('every point gets a non-degenerate handle so the curve stays smooth', () => {
    const superellipse: ShapePrimitive = { kind: 'superellipse', width: 300, height: 200, exponent: 4 }
    const points = convertToFreeform(superellipse, 20)
    for (const p of points) {
      expect(Number.isFinite(p.hx)).toBe(true)
      expect(Number.isFinite(p.hy)).toBe(true)
    }
  })
})
