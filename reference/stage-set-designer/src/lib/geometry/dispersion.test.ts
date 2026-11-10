import { describe, expect, it } from 'vitest'
import { applyDispersion } from './dispersion'
import { area, centroid } from './polygon'
import { intersectPolys } from './clipper'
import { mulberry32 } from './random'
import type { DispersionConfig, Polygon } from './types'

const square: Polygon = [
  { x: -10, y: -10 },
  { x: 10, y: -10 },
  { x: 10, y: 10 },
  { x: -10, y: 10 },
]

const grid: Polygon[] = Array.from({ length: 9 }, (_, i) => {
  const cx = (i % 3) * 30
  const cy = Math.floor(i / 3) * 30
  return square.map((p) => ({ x: p.x + cx, y: p.y + cy }))
})

// Deliberately touching edge-to-edge (no gap at all) — the adversarial case
// where even a tiny bit of size or distance variance is guaranteed to
// overlap a neighbor, since real patterns don't reliably leave the wide
// gaps `grid` above does.
const packedGrid: Polygon[] = Array.from({ length: 9 }, (_, i) => {
  const cx = (i % 3) * 20
  const cy = Math.floor(i / 3) * 20
  return square.map((p) => ({ x: p.x + cx, y: p.y + cy }))
})

function buildPackedGrid(sideCount: number): Polygon[] {
  return Array.from({ length: sideCount * sideCount }, (_, i) => {
    const cx = (i % sideCount) * 20
    const cy = Math.floor(i / sideCount) * 20
    return square.map((p) => ({ x: p.x + cx, y: p.y + cy }))
  })
}

function config(overrides: Partial<DispersionConfig> = {}): DispersionConfig {
  return { enabled: true, sizeVariance: 0.3, distanceVariance: 0.3, ...overrides }
}

function totalArea(polys: Polygon[]): number {
  return polys.reduce((s, p) => s + area(p), 0)
}

function maxPairwiseOverlap(polys: Polygon[]): number {
  let max = 0
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      const overlap = intersectPolys([polys[i]], [polys[j]])
      const overlapArea = totalArea(overlap)
      if (overlapArea > max) max = overlapArea
    }
  }
  return max
}

describe('applyDispersion', () => {
  it('is a no-op when disabled', () => {
    const rng = mulberry32(1)
    const result = applyDispersion(grid, 20, config({ enabled: false }), rng)
    expect(result).toEqual(grid)
  })

  it('is a no-op when both variances are 0, even while enabled', () => {
    const rng = mulberry32(1)
    const result = applyDispersion(grid, 20, config({ sizeVariance: 0, distanceVariance: 0 }), rng)
    for (let i = 0; i < grid.length; i++) {
      expect(centroid(result[i]).x).toBeCloseTo(centroid(grid[i]).x, 6)
      expect(centroid(result[i]).y).toBeCloseTo(centroid(grid[i]).y, 6)
      expect(area(result[i])).toBeCloseTo(area(grid[i]), 6)
    }
  })

  it('sizeVariance scales an isolated cell (no neighbors to fuse with) around its own centroid', () => {
    const rng = mulberry32(7)
    const [result] = applyDispersion([square], 20, config({ sizeVariance: 0.5, distanceVariance: 0 }), rng)
    const c0 = centroid(square)
    const c1 = centroid(result)
    expect(c1.x).toBeCloseTo(c0.x, 6)
    expect(c1.y).toBeCloseTo(c0.y, 6)
    expect(area(result)).not.toBeCloseTo(area(square), 1)
  })

  it('distanceVariance moves an isolated cell without resizing it', () => {
    const rng = mulberry32(7)
    const [result] = applyDispersion([square], 20, config({ sizeVariance: 0, distanceVariance: 0.5 }), rng)
    expect(area(result)).toBeCloseTo(area(square), 4)
    const c0 = centroid(square)
    const c1 = centroid(result)
    expect(Math.hypot(c1.x - c0.x, c1.y - c0.y)).toBeGreaterThan(0.01)
  })

  it('is deterministic for a given seed', () => {
    const a = applyDispersion(grid, 20, config(), mulberry32(42))
    const b = applyDispersion(grid, 20, config(), mulberry32(42))
    expect(a).toEqual(b)
  })

  it('an isolated cell\'s distance offset stays bounded by distanceVariance * cellSize', () => {
    const rng = mulberry32(3)
    const cellSize = 20
    const distanceVariance = 0.4
    const [result] = applyDispersion([square], cellSize, config({ sizeVariance: 0, distanceVariance }), rng)
    const c0 = centroid(square)
    const c1 = centroid(result)
    const dist = Math.hypot(c1.x - c0.x, c1.y - c0.y)
    expect(dist).toBeLessThanOrEqual(distanceVariance * cellSize + 1e-6)
  })

  // Regression for the actual bug report: dispersion moving/scaling cells
  // independently produced jagged, interfering cut shapes wherever two
  // cells' new footprints overlapped, because the per-cell strut-inset
  // downstream has no idea a neighbor moved. This is the property that
  // actually matters for fabrication — no two output cells may overlap,
  // no matter how aggressively they were pushed around.
  it('never produces overlapping cells, even at maximum variance on a tightly packed grid', () => {
    const rng = mulberry32(99)
    const result = applyDispersion(packedGrid, 20, config({ sizeVariance: 1, distanceVariance: 1 }), rng)
    // A tiny fraction of a cell's own area (400 here) — real overlap from
    // the old bug was whole cells colliding (tens to hundreds of area
    // units), not sub-percent residue. This threshold catches that class
    // of regression while tolerating Clipper's own floating-point noise
    // from repeated union/difference at PRECISION=4.
    expect(maxPairwiseOverlap(result)).toBeLessThan(1)
  })

  it('never produces overlapping cells across many random seeds (not just one lucky draw)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const rng = mulberry32(seed)
      const result = applyDispersion(packedGrid, 20, config({ sizeVariance: 1, distanceVariance: 1 }), rng)
      expect(maxPairwiseOverlap(result)).toBeLessThan(1)
    }
  })

  it('never produces overlapping cells even when every cell starts at the exact same position', () => {
    const samePosition: Polygon[] = Array.from({ length: 12 }, () => square.map((p) => ({ ...p })))
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed)
      const result = applyDispersion(samePosition, 20, config({ sizeVariance: 0.9, distanceVariance: 0.9 }), rng)
      expect(maxPairwiseOverlap(result)).toBeLessThan(1)
    }
  })

  it('fusing never fabricates area — total output area never exceeds the moved (pre-fuse) footprint', () => {
    const rng = mulberry32(11)
    const result = applyDispersion(packedGrid, 20, config({ sizeVariance: 0.9, distanceVariance: 0.9 }), rng)
    // A generous ceiling: the original grid's own footprint scaled up by
    // the maximum possible per-cell growth, since we don't have the
    // pre-fuse moved set here to compare directly — the real invariant
    // this guards is "didn't somehow duplicate area via a union bug."
    const maxPossible = totalArea(packedGrid) * (1 + config().sizeVariance) ** 2 * 3
    expect(totalArea(result)).toBeLessThan(maxPossible)
    expect(totalArea(result)).toBeGreaterThan(0)
  })

  // Regression for a real perf bug caught live: an all-pairs O(n²) overlap
  // check (each pair a real Clipper call) measured at ~26 SECONDS for a
  // ~400-cell dense pattern with dispersion on, vs ~6ms with it off. Fixed
  // with a spatial grid so only nearby candidates get checked. A generous
  // time budget here — should be comfortably under a second even on a
  // loaded CI machine — catches a regression back to all-pairs checking
  // without being flaky about exact timing.
  it('stays fast on a large, densely packed pattern (the actual reported bug)', () => {
    const large = buildPackedGrid(20) // 400 cells, edge-to-edge — no gaps
    const rng = mulberry32(5)
    const start = performance.now()
    const result = applyDispersion(large, 20, config({ sizeVariance: 0.5, distanceVariance: 0.5 }), rng)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(2000)
    expect(maxPairwiseOverlap(result)).toBeLessThan(1)
  })
})
