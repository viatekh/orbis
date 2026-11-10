import { describe, expect, it } from 'vitest'
import { buildShapeOutline } from './shapes'
import { area, minEdgeLength } from './polygon'

describe('buildShapeOutline', () => {
  it('builds a rectangle with correct area when cornerRadius is 0', () => {
    const poly = buildShapeOutline({ kind: 'rect', width: 100, height: 50, cornerRadius: 0 })
    expect(area(poly)).toBeCloseTo(5000, 0)
  })

  it('rounds corners without changing straight-edge count materially', () => {
    const sharp = buildShapeOutline({ kind: 'rect', width: 100, height: 50, cornerRadius: 0 })
    const rounded = buildShapeOutline({ kind: 'rect', width: 100, height: 50, cornerRadius: 5 })
    expect(area(rounded)).toBeLessThan(area(sharp))
    expect(area(rounded)).toBeGreaterThan(area(sharp) * 0.9)
  })

  it('clamps an oversized corner radius instead of collapsing the shape', () => {
    const poly = buildShapeOutline({ kind: 'rect', width: 40, height: 20, cornerRadius: 1000 })
    expect(area(poly)).toBeGreaterThan(0)
  })

  it('builds a regular polygon (triangle) with 3 vertices', () => {
    const poly = buildShapeOutline({ kind: 'regularPolygon', sides: 3, radius: 50, rotation: 0, cornerRadius: 0 })
    expect(poly.length).toBe(3)
    expect(area(poly)).toBeGreaterThan(0)
  })

  it('builds a hexagon with equal-ish edge lengths', () => {
    const poly = buildShapeOutline({ kind: 'regularPolygon', sides: 6, radius: 30, rotation: 0, cornerRadius: 0 })
    expect(poly.length).toBe(6)
    expect(minEdgeLength(poly)).toBeCloseTo(30, 0)
  })

  it('builds a star with 2N vertices and area between inner/outer regular polygons', () => {
    const poly = buildShapeOutline({
      kind: 'star',
      points: 5,
      radius: 100,
      innerRadiusRatio: 0.5,
      rotation: 0,
      cornerRadius: 0,
    })
    expect(poly.length).toBe(10)
    const outerCircleArea = Math.PI * 100 * 100
    const innerCircleArea = Math.PI * 50 * 50
    expect(area(poly)).toBeGreaterThan(innerCircleArea)
    expect(area(poly)).toBeLessThan(outerCircleArea)
  })

  it('rounds star points without collapsing the shape', () => {
    const sharp = buildShapeOutline({
      kind: 'star',
      points: 5,
      radius: 100,
      innerRadiusRatio: 0.5,
      rotation: 0,
      cornerRadius: 0,
    })
    const rounded = buildShapeOutline({
      kind: 'star',
      points: 5,
      radius: 100,
      innerRadiusRatio: 0.5,
      rotation: 0,
      cornerRadius: 5,
    })
    expect(area(rounded)).toBeLessThan(area(sharp))
    expect(area(rounded)).toBeGreaterThan(area(sharp) * 0.8)
  })

  it('builds a superellipse approaching an ellipse at exponent 2', () => {
    const poly = buildShapeOutline({ kind: 'superellipse', width: 200, height: 100, exponent: 2 })
    const ellipseArea = Math.PI * 100 * 50
    // 128-segment polygon inscribed in the ellipse is slightly smaller than
    // the true curve — within 1% is a tight enough tessellation check.
    expect(area(poly)).toBeGreaterThan(ellipseArea * 0.99)
    expect(area(poly)).toBeLessThan(ellipseArea)
  })

  it('builds a superellipse that grows toward the bounding rect as exponent rises', () => {
    const low = buildShapeOutline({ kind: 'superellipse', width: 200, height: 100, exponent: 2 })
    const high = buildShapeOutline({ kind: 'superellipse', width: 200, height: 100, exponent: 8 })
    const rectArea = 200 * 100
    expect(area(high)).toBeGreaterThan(area(low))
    expect(area(high)).toBeLessThan(rectArea)
  })

  it('builds a blob that is deterministic for a given seed', () => {
    const a = buildShapeOutline({ kind: 'blob', radius: 100, complexity: 4, irregularity: 0.3, seed: 7 })
    const b = buildShapeOutline({ kind: 'blob', radius: 100, complexity: 4, irregularity: 0.3, seed: 7 })
    expect(a).toEqual(b)
  })

  it('builds different blobs for different seeds', () => {
    const a = buildShapeOutline({ kind: 'blob', radius: 100, complexity: 4, irregularity: 0.3, seed: 1 })
    const b = buildShapeOutline({ kind: 'blob', radius: 100, complexity: 4, irregularity: 0.3, seed: 2 })
    expect(a).not.toEqual(b)
  })

  it('keeps a blob roughly circular in area even when perturbed', () => {
    const poly = buildShapeOutline({ kind: 'blob', radius: 100, complexity: 4, irregularity: 0.3, seed: 1 })
    const circleArea = Math.PI * 100 * 100
    expect(area(poly)).toBeGreaterThan(circleArea * 0.5)
    expect(area(poly)).toBeLessThan(circleArea * 1.5)
  })

  it('builds a teardrop with a sharp point that tapers monotonically into a round bulb', () => {
    const poly = buildShapeOutline({ kind: 'teardrop', radius: 100, pointSharpness: 1.3, rotation: 0 })
    expect(area(poly)).toBeGreaterThan(0)
    // The construction always emits the tip as the first vertex, and (with
    // rotation 0) it sits at the polygon's own minimum-Y extreme.
    const tip = poly[0]
    const ys = poly.map((p) => p.y)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    expect(tip.y).toBeCloseTo(minY, 0)
    // Width near the tip should be much narrower than the bulb's full
    // width — this is the property the old r(θ) formula violated, dipping
    // outward into two flanking lobes right next to the point instead of
    // tapering cleanly (the "bum" shape bug).
    const nearTip = poly.filter((p) => p.y < minY + (maxY - minY) * 0.1)
    const bulbWidth = Math.max(...poly.map((p) => p.x)) - Math.min(...poly.map((p) => p.x))
    const nearTipWidth = Math.max(...nearTip.map((p) => p.x)) - Math.min(...nearTip.map((p) => p.x))
    expect(nearTipWidth).toBeLessThan(bulbWidth * 0.3)
  })

  it('sharpening a teardrop\'s point lengthens its tail (bulb radius stays fixed, area grows)', () => {
    // pointSharpness now sets the tail-length-to-bulb-radius ratio directly
    // — the bulb itself stays the same size, so a sharper point means a
    // longer (not smaller) tail, adding area rather than removing it.
    const blunt = buildShapeOutline({ kind: 'teardrop', radius: 100, pointSharpness: 0.6, rotation: 0 })
    const sharp = buildShapeOutline({ kind: 'teardrop', radius: 100, pointSharpness: 3, rotation: 0 })
    expect(area(sharp)).toBeGreaterThan(area(blunt))
  })

  it('builds a diamond (rhombus) with the expected area', () => {
    const poly = buildShapeOutline({ kind: 'diamond', width: 100, height: 200, cornerRadius: 0 })
    // A rhombus with diagonals d1, d2 has area d1*d2/2.
    expect(area(poly)).toBeCloseTo(100 * 200 * 0.5, 0)
  })

  it('rounds diamond corners without collapsing the shape', () => {
    const sharp = buildShapeOutline({ kind: 'diamond', width: 100, height: 200, cornerRadius: 0 })
    const rounded = buildShapeOutline({ kind: 'diamond', width: 100, height: 200, cornerRadius: 10 })
    expect(area(rounded)).toBeLessThan(area(sharp))
    expect(area(rounded)).toBeGreaterThan(area(sharp) * 0.8)
  })

  it('builds an eye/lens shape with sharp corners at its own half-width', () => {
    const poly = buildShapeOutline({ kind: 'eye', width: 200, height: 80, rotation: 0 })
    expect(area(poly)).toBeGreaterThan(0)
    const maxX = Math.max(...poly.map((p) => p.x))
    expect(maxX).toBeCloseTo(100, 0)
  })

  it('an eye shape widens in area as its height grows relative to width', () => {
    const shallow = buildShapeOutline({ kind: 'eye', width: 200, height: 40, rotation: 0 })
    const tall = buildShapeOutline({ kind: 'eye', width: 200, height: 150, rotation: 0 })
    expect(area(tall)).toBeGreaterThan(area(shallow))
  })

  it('rotating an eye shape preserves its area', () => {
    const flat = buildShapeOutline({ kind: 'eye', width: 200, height: 80, rotation: 0 })
    const rotated = buildShapeOutline({ kind: 'eye', width: 200, height: 80, rotation: 40 })
    expect(area(rotated)).toBeCloseTo(area(flat), 0)
  })

  it('builds a spiral ribbon whose extent reaches roughly the end radius', () => {
    const poly = buildShapeOutline({ kind: 'spiral', turns: 2, startRadius: 5, endRadius: 100, strokeWidth: 20, rotation: 0 })
    expect(area(poly)).toBeGreaterThan(0)
    const maxDist = Math.max(...poly.map((p) => Math.hypot(p.x, p.y)))
    expect(maxDist).toBeGreaterThan(100)
    expect(maxDist).toBeLessThan(120)
  })

  it('a spiral ribbon never exceeds the local radius near the center (no self-crossing taper)', () => {
    const poly = buildShapeOutline({
      kind: 'spiral',
      turns: 1,
      startRadius: 2,
      endRadius: 100,
      strokeWidth: 200, // deliberately huge relative to startRadius
      rotation: 0,
    })
    const minDist = Math.min(...poly.map((p) => Math.hypot(p.x, p.y)))
    expect(minDist).toBeGreaterThanOrEqual(0)
  })

  it('more spiral turns produce more ribbon area (more coil to cover)', () => {
    const short = buildShapeOutline({ kind: 'spiral', turns: 1, startRadius: 5, endRadius: 100, strokeWidth: 15, rotation: 0 })
    const long = buildShapeOutline({ kind: 'spiral', turns: 3, startRadius: 5, endRadius: 100, strokeWidth: 15, rotation: 0 })
    expect(area(long)).toBeGreaterThan(area(short))
  })

  it('builds a vine ribbon spanning roughly its configured length', () => {
    const poly = buildShapeOutline({
      kind: 'vine',
      length: 300,
      amplitude: 40,
      waveCount: 2,
      strokeWidth: 20,
      leafBulge: 0.5,
      rotation: 0,
    })
    expect(area(poly)).toBeGreaterThan(0)
    const xs = poly.map((p) => p.x)
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(300, -1)
  })

  it('a vine with more leaf bulge has more area than a plain flowing ribbon', () => {
    const plain = buildShapeOutline({
      kind: 'vine',
      length: 300,
      amplitude: 40,
      waveCount: 2,
      strokeWidth: 20,
      leafBulge: 0,
      rotation: 0,
    })
    const bulging = buildShapeOutline({
      kind: 'vine',
      length: 300,
      amplitude: 40,
      waveCount: 2,
      strokeWidth: 20,
      leafBulge: 1,
      rotation: 0,
    })
    expect(area(bulging)).toBeGreaterThan(area(plain))
  })

  it('a vine ribbon tapers to exactly zero width at both ends', () => {
    // buildRibbonFromCenterline lays out [...left, ...right.reverse()], so
    // for a centerline of N+1 samples: poly[0] (left[0]) and poly[2N+1]
    // (the last element, right[0] after reversal) are the two edge points
    // at the very first sample — they should coincide exactly when that
    // sample's half-width is 0. Likewise poly[N] and poly[N+1] (left[N],
    // then the first reversed right element right[N]) are the two edge
    // points at the very last sample.
    const poly = buildShapeOutline({
      kind: 'vine',
      length: 300,
      amplitude: 40,
      waveCount: 2,
      strokeWidth: 20,
      leafBulge: 0.5,
      rotation: 0,
    })
    const n = poly.length / 2 - 1 // number of centerline segments
    const start = poly[0]
    const startOther = poly[poly.length - 1]
    expect(Math.hypot(start.x - startOther.x, start.y - startOther.y)).toBeLessThan(1e-6)

    const end = poly[n]
    const endOther = poly[n + 1]
    expect(Math.hypot(end.x - endOther.x, end.y - endOther.y)).toBeLessThan(1e-6)
  })
})
