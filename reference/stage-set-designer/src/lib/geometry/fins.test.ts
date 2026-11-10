import { describe, expect, it } from 'vitest'
import { buildLayerFins } from './fins'
import { area, centroid } from './polygon'
import type { Polygon } from './types'

const square: Polygon = [
  { x: -100, y: -100 },
  { x: 100, y: -100 },
  { x: 100, y: 100 },
  { x: -100, y: 100 },
]

const smallHole: Polygon = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 10, y: 10 },
  { x: -10, y: 10 },
]

describe('buildLayerFins', () => {
  it('returns nothing when depth is 0 (flush/coplanar — no fins needed)', () => {
    expect(buildLayerFins([square], 0)).toEqual([])
  })

  it('produces non-degenerate rectangular tabs standing out from the boundary', () => {
    const fins = buildLayerFins([square], 15, 6, 40)
    expect(fins.length).toBeGreaterThan(0)
    for (const fin of fins) {
      expect(fin.length).toBe(4)
      expect(area(fin)).toBeGreaterThan(0)
    }
  })

  it('every fin extends outside the source boundary (standing away from the piece, not into it)', () => {
    // The two BASE points sit exactly on the boundary by construction —
    // it's the two TIP points, depth mm further along the outward normal,
    // that should clear it.
    const fins = buildLayerFins([square], 15, 6, 40)
    for (const fin of fins) {
      const [, tip1, tip2] = fin
      for (const p of [tip1, tip2]) {
        const outside = p.x < -100.001 || p.x > 100.001 || p.y < -100.001 || p.y > 100.001
        expect(outside).toBe(true)
      }
    }
  })

  it('a larger depth produces longer fins', () => {
    const shallow = buildLayerFins([square], 5, 6, 40)
    const deep = buildLayerFins([square], 30, 6, 40)
    const finLength = (fin: Polygon) => Math.max(...fin.map((p) => Math.hypot(p.x, p.y))) - 100
    expect(Math.max(...deep.map(finLength))).toBeGreaterThan(Math.max(...shallow.map(finLength)))
  })

  it('skips a small contour relative to the largest one (treats it as a hole, not an outer silhouette)', () => {
    const withHole = buildLayerFins([square, smallHole], 15, 6, 40)
    const withoutHole = buildLayerFins([square], 15, 6, 40)
    // Same fin count either way — the small hole contour contributed none.
    expect(withHole.length).toBe(withoutHole.length)
  })

  it('multiple same-size outer pieces (e.g. several unmerged instances) each get their own fins', () => {
    const second: Polygon = square.map((p) => ({ x: p.x + 500, y: p.y }))
    const fins = buildLayerFins([square, second], 15, 6, 40)
    const singlePieceFins = buildLayerFins([square], 15, 6, 40)
    expect(fins.length).toBeCloseTo(singlePieceFins.length * 2, -1)
  })

  it('fins stay roughly centered on their own base point along the boundary (no drift)', () => {
    const fins = buildLayerFins([square], 20, 6, 50)
    for (const fin of fins) {
      const c = centroid(fin)
      // Every fin base sits on the 200x200 square boundary — centroid
      // should be within depth+width of that boundary, not off in space.
      const onBoundaryish = Math.abs(Math.abs(c.x) - 100) < 25 || Math.abs(Math.abs(c.y) - 100) < 25
      expect(onBoundaryish).toBe(true)
    }
  })
})
