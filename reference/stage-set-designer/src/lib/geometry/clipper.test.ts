import { describe, expect, it } from 'vitest'
import { area } from './polygon'
import { containsPoint, inset, intersectPolys, outset, roundCorners, unionPolys } from './clipper'
import type { Polygon } from './types'

const square10: Polygon = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
]

const squareCW: Polygon = [...square10].reverse()

describe('clipper.inset', () => {
  it('always reduces area for a positive delta (CCW input)', () => {
    const [result] = inset(square10, 1)
    expect(area(result)).toBeLessThan(area(square10))
    expect(area(result)).toBeCloseTo(64, 0)
  })

  it('always reduces area for a positive delta (CW input) — orientation bug guard', () => {
    const [result] = inset(squareCW, 1)
    expect(area(result)).toBeLessThan(area(squareCW))
    expect(area(result)).toBeCloseTo(64, 0)
  })

  it('grows the polygon for outset', () => {
    const [result] = outset(square10, 1)
    expect(area(result)).toBeGreaterThan(area(square10))
  })

  it('collapses to nothing when delta exceeds half the smallest dimension', () => {
    const result = inset(square10, 10)
    for (const poly of result) {
      expect(area(poly)).toBeLessThan(1)
    }
  })
})

describe('clipper.intersectPolys', () => {
  it('clips a large polygon down to the boundary', () => {
    const big: Polygon = [
      { x: -10, y: -10 },
      { x: 20, y: -10 },
      { x: 20, y: 20 },
      { x: -10, y: 20 },
    ]
    const [result] = intersectPolys([big], [square10])
    expect(area(result)).toBeCloseTo(100)
  })

  it('returns empty for non-overlapping polygons', () => {
    const elsewhere: Polygon = [
      { x: 100, y: 100 },
      { x: 110, y: 100 },
      { x: 110, y: 110 },
      { x: 100, y: 110 },
    ]
    expect(intersectPolys([elsewhere], [square10])).toEqual([])
  })
})

describe('clipper.unionPolys', () => {
  it('merges two overlapping cells into one region', () => {
    const a: Polygon = square10
    const b: Polygon = [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 15 },
      { x: 5, y: 15 },
    ]
    const result = unionPolys([a, b])
    const totalArea = result.reduce((sum, p) => sum + area(p), 0)
    // union area < sum of parts (100+100) because they overlap
    expect(totalArea).toBeLessThan(200)
    expect(totalArea).toBeGreaterThan(100)
  })
})

describe('clipper.roundCorners', () => {
  it('keeps straight edges in place while rounding corners', () => {
    const rounded = roundCorners(square10, 2)
    // area shrinks (corners cut) but stays close to the original square
    expect(area(rounded)).toBeLessThan(100)
    expect(area(rounded)).toBeGreaterThan(90)
  })

  it('is a no-op for radius <= 0', () => {
    expect(roundCorners(square10, 0)).toBe(square10)
  })
})

describe('clipper.containsPoint', () => {
  it('detects points inside and outside', () => {
    expect(containsPoint({ x: 5, y: 5 }, square10)).toBe(true)
    expect(containsPoint({ x: 50, y: 50 }, square10)).toBe(false)
  })
})
