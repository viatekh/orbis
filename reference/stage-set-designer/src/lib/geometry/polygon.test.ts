import { describe, expect, it } from 'vitest'
import { area, bounds, centroid, mirrorPolygon, minEdgeLength, rotatePolygon, signedArea, stripClosingPoint } from './polygon'
import type { Point, Polygon } from './types'

const square: Polygon = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

describe('polygon', () => {
  it('computes area of a square', () => {
    expect(area(square)).toBeCloseTo(100)
  })

  it('signedArea flips sign when winding reverses', () => {
    const reversed = [...square].reverse()
    expect(Math.sign(signedArea(square))).toBe(-Math.sign(signedArea(reversed)))
  })

  it('computes centroid of a square', () => {
    const c = centroid(square)
    expect(c.x).toBeCloseTo(5)
    expect(c.y).toBeCloseTo(5)
  })

  it('computes bounds', () => {
    expect(bounds(square)).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 })
  })

  it('computes min edge length', () => {
    const rect: Polygon = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ]
    expect(minEdgeLength(rect)).toBeCloseTo(10)
  })

  it('strips a repeated closing point', () => {
    const closed = [...square, square[0]]
    expect(stripClosingPoint(closed)).toEqual(square)
  })

  it('leaves an already-open polygon untouched', () => {
    expect(stripClosingPoint(square)).toEqual(square)
  })
})

describe('mirrorPolygon', () => {
  const origin: Point = { x: 0, y: 0 }

  it('reflects a point across the X axis (axis angle 0)', () => {
    const poly: Polygon = [{ x: 3, y: 5 }]
    const mirrored = mirrorPolygon(poly, origin, 0)
    expect(mirrored[0].x).toBeCloseTo(3)
    expect(mirrored[0].y).toBeCloseTo(-5)
  })

  it('reflects a point across the Y axis (axis angle 90)', () => {
    const poly: Polygon = [{ x: 3, y: 5 }]
    const mirrored = mirrorPolygon(poly, origin, 90)
    expect(mirrored[0].x).toBeCloseTo(-3)
    expect(mirrored[0].y).toBeCloseTo(5)
  })

  it('leaves a point already on the mirror axis unchanged', () => {
    // A point at angle 30° from origin, mirrored across the 30° axis, stays put.
    const rad = (30 * Math.PI) / 180
    const poly: Polygon = [{ x: 10 * Math.cos(rad), y: 10 * Math.sin(rad) }]
    const mirrored = mirrorPolygon(poly, origin, 30)
    expect(mirrored[0].x).toBeCloseTo(poly[0].x)
    expect(mirrored[0].y).toBeCloseTo(poly[0].y)
  })

  it('is centered on an arbitrary center point, not just the origin', () => {
    const center: Point = { x: 100, y: -50 }
    const poly: Polygon = [{ x: 103, y: -45 }] // offset (3, 5) from center
    const mirrored = mirrorPolygon(poly, center, 0)
    expect(mirrored[0].x).toBeCloseTo(103)
    expect(mirrored[0].y).toBeCloseTo(-55) // offset (3, -5) from center
  })

  it('is its own inverse (mirroring twice returns the original)', () => {
    const poly: Polygon = [
      { x: 12, y: -7 },
      { x: -4, y: 9 },
    ]
    const twice = mirrorPolygon(mirrorPolygon(poly, origin, 40), origin, 40)
    expect(twice[0].x).toBeCloseTo(poly[0].x)
    expect(twice[0].y).toBeCloseTo(poly[0].y)
  })

  it('preserves distance from center (a rigid reflection, not a distortion)', () => {
    const center: Point = { x: 5, y: 5 }
    const poly: Polygon = [{ x: 12, y: 3 }]
    const before = Math.hypot(poly[0].x - center.x, poly[0].y - center.y)
    const mirrored = mirrorPolygon(poly, center, 65)
    const after = Math.hypot(mirrored[0].x - center.x, mirrored[0].y - center.y)
    expect(after).toBeCloseTo(before)
  })

  it('reverses winding direction (mirroring flips chirality)', () => {
    const mirrored = mirrorPolygon(square, origin, 0)
    expect(Math.sign(signedArea(mirrored))).toBe(-Math.sign(signedArea(square)))
  })

  it('rotating then mirroring across that same angle undoes the rotation\'s handedness change', () => {
    // Sanity check tying mirrorPolygon and rotatePolygon together: a shape
    // rotated by θ and then mirrored across axis θ/2 lands where mirroring
    // it directly across axis 0 and rotating by -θ would — reflections and
    // rotations compose the way the wedge-symmetry code assumes they do.
    const p: Polygon = [{ x: 7, y: 2 }]
    const viaRotateThenMirror = mirrorPolygon(rotatePolygon(p, origin, 40), origin, 20)
    const viaMirrorDirect = mirrorPolygon(p, origin, 0)
    expect(viaRotateThenMirror[0].x).toBeCloseTo(viaMirrorDirect[0].x)
    expect(viaRotateThenMirror[0].y).toBeCloseTo(viaMirrorDirect[0].y)
  })
})
