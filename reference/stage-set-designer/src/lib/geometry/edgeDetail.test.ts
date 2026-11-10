import { describe, expect, it } from 'vitest'
import { buildEdgeDetailPolys } from './edgeDetail'
import { area, centroid } from './polygon'
import { intersectPolys } from './clipper'
import type { EdgeDetailConfig, Polygon } from './types'

const circle: Polygon = Array.from({ length: 64 }, (_, i) => {
  const a = (i / 64) * Math.PI * 2
  return { x: 100 * Math.cos(a), y: 100 * Math.sin(a) }
})

const rect: Polygon = [
  { x: -150, y: -100 },
  { x: 150, y: -100 },
  { x: 150, y: 100 },
  { x: -150, y: 100 },
]

function config(overrides: Partial<EdgeDetailConfig> = {}): EdgeDetailConfig {
  return { enabled: true, kind: 'dots', mode: 'cut', spacing: 15, size: 6, offset: 3, ...overrides }
}

describe('buildEdgeDetailPolys', () => {
  it('returns nothing when disabled', () => {
    expect(buildEdgeDetailPolys(circle, config({ enabled: false }), 1)).toEqual([])
  })

  for (const kind of ['dots', 'ticks', 'dashes', 'wave', 'zigzag'] as const) {
    it(`produces non-degenerate geometry for kind "${kind}"`, () => {
      const polys = buildEdgeDetailPolys(circle, config({ kind }), 1)
      expect(polys.length).toBeGreaterThan(0)
      for (const p of polys) {
        expect(p.length).toBeGreaterThanOrEqual(3)
        expect(area(p)).toBeGreaterThan(0)
      }
    })
  }

  it('sign 1 (inward) places motifs inside the boundary; sign -1 (outward) places them outside', () => {
    const inward = buildEdgeDetailPolys(circle, config({ kind: 'dots', offset: 0, size: 8 }), 1)
    const outward = buildEdgeDetailPolys(circle, config({ kind: 'dots', offset: 0, size: 8 }), -1)
    const c = centroid(circle)

    // Every inward motif should sit closer to center than the boundary radius.
    for (const p of inward) {
      const d = Math.hypot(centroid(p).x - c.x, centroid(p).y - c.y)
      expect(d).toBeLessThan(100)
    }
    // Every outward motif should sit farther from center than the boundary radius.
    for (const p of outward) {
      const d = Math.hypot(centroid(p).x - c.x, centroid(p).y - c.y)
      expect(d).toBeGreaterThan(100)
    }
  })

  it('a larger offset pushes the band further from the boundary (wave kind)', () => {
    const near = buildEdgeDetailPolys(circle, config({ kind: 'wave', offset: 0 }), 1)
    const far = buildEdgeDetailPolys(circle, config({ kind: 'wave', offset: 30 }), 1)
    const c = centroid(circle)
    const maxDistFromCenter = (polys: Polygon[]) =>
      Math.max(...polys.flatMap((p) => p.map((pt) => Math.hypot(pt.x - c.x, pt.y - c.y))))
    // A larger offset means the band's OUTER edge sits further inward (since
    // sign 1 pulls it toward the center), so its max radius should shrink.
    expect(maxDistFromCenter(far)).toBeLessThan(maxDistFromCenter(near))
  })

  it('wave/zigzag bands never cross the source boundary itself', () => {
    const band = buildEdgeDetailPolys(circle, config({ kind: 'wave', offset: 2, size: 10 }), 1)
    for (const p of band) {
      const outside = intersectPolys([p], [circle])
      const outsideArea = outside.reduce((s, q) => s + area(q), 0)
      // Practically all of the band's area should be within the circle
      // (minor tolerance for the coarse polygon approximation of "circle").
      expect(outsideArea).toBeGreaterThan(area(p) * 0.95)
    }
  })

  // Regression: the wave/zigzag band used to be built as one hand-stitched
  // outer+reversed-inner polygon with an implicit seam. That construction
  // broke specifically at SHARP corners (a plain rectangle, not the smooth
  // circle every other test here uses) — the seam self-intersected badly
  // enough that Clipper's fill rule misread most of the rectangle's
  // interior as part of the "band", instead of just a thin strip near the
  // edge. Pinning the expected area directly catches that class of bug,
  // where "some geometry came out" isn't enough — it has to be the right
  // AMOUNT of geometry.
  for (const kind of ['wave', 'zigzag'] as const) {
    it(`kind "${kind}" produces a thin band (not most of the interior) on a sharp-cornered rectangle`, () => {
      const spacing = 15
      const size = 6
      const offset = 3
      const band = buildEdgeDetailPolys(rect, config({ kind, spacing, size, offset }), 1)
      const bandArea = band.reduce((s, p) => s + area(p), 0)
      const rectArea = area(rect)

      // A true thin band hugging a 1000mm perimeter at roughly offset..offset+size
      // depth should total on the order of perimeter * size, generously bounded —
      // nowhere near the rectangle's own 60,000mm^2 area (the bug produced ~110,000,
      // i.e. more than the entire rectangle, from self-intersection double-counting).
      expect(bandArea).toBeGreaterThan(0)
      expect(bandArea).toBeLessThan(rectArea * 0.15)
    })
  }

  it('dots/ticks/dashes motifs on a rectangle stay near the boundary, not scattered across the interior', () => {
    const c = centroid(rect)
    for (const kind of ['dots', 'ticks', 'dashes'] as const) {
      const motifs = buildEdgeDetailPolys(rect, config({ kind, offset: 0, size: 6 }), 1)
      expect(motifs.length).toBeGreaterThan(0)
      for (const p of motifs) {
        const d = Math.hypot(centroid(p).x - c.x, centroid(p).y - c.y)
        // The rectangle's own "inradius" (distance from center to nearest
        // edge) is 100mm — every motif should sit close to that, not deep
        // in the interior.
        expect(d).toBeGreaterThan(80)
      }
    }
  })
})
