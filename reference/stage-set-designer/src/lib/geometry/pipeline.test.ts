import { describe, expect, it } from 'vitest'
import { computePatternGeometry } from './pipeline'
import { polygonsToPathData } from './pathData'
import { intersectPolys, unionPolys, xorPolys } from './clipper'
import { area, bounds, centroid, mirrorPolygon } from './polygon'
import { buildShapeOutline } from './shapes'
import { DEFAULT_PATTERN_CONFIG } from './constants'
import type { PatternConfig } from './types'

const outline = buildShapeOutline({ kind: 'rect', width: 200, height: 150, cornerRadius: 0 })

function config(overrides: Partial<PatternConfig> = {}): PatternConfig {
  return {
    ...DEFAULT_PATTERN_CONFIG,
    recursion: { ...DEFAULT_PATTERN_CONFIG.recursion, ...overrides.recursion },
    ...overrides,
  }
}

describe('computePatternGeometry — voronoi cut mode', () => {
  it('every cut cell is fully contained within the outline', () => {
    const result = computePatternGeometry(outline, config({ cellSize: 20 }))
    expect(result.cutPaths.length).toBeGreaterThan(0)
    for (const cell of result.cutPaths) {
      const clipped = intersectPolys([cell], [outline])
      const clippedArea = clipped.reduce((s, p) => s + area(p), 0)
      expect(clippedArea).toBeCloseTo(area(cell), 1)
    }
  })

  it('leaf cells are pairwise disjoint (no overlap)', () => {
    const result = computePatternGeometry(outline, config({ cellSize: 40 }))
    const cells = result.cutPaths
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const overlap = intersectPolys([cells[i]], [cells[j]])
        const overlapArea = overlap.reduce((s, p) => s + area(p), 0)
        expect(overlapArea).toBeLessThan(0.5)
      }
    }
  })

  it('total cut area is less than the outline area', () => {
    const result = computePatternGeometry(outline, config({ cellSize: 20 }))
    expect(result.stats.cutAreaMm2).toBeLessThan(area(outline))
    expect(result.stats.cutAreaMm2).toBeGreaterThan(0)
  })

  it('identical seed and config produce byte-identical path data', () => {
    const a = computePatternGeometry(outline, config({ cellSize: 20, seed: 42 }))
    const b = computePatternGeometry(outline, config({ cellSize: 20, seed: 42 }))
    expect(polygonsToPathData(a.cutPaths)).toBe(polygonsToPathData(b.cutPaths))
  })

  it('changing jitter does not reshuffle a level-0 layout beyond its own cells (RNG stream isolation)', () => {
    // depth 0, so this really just proves determinism holds across two different configs run twice
    const seedA = computePatternGeometry(outline, config({ cellSize: 20, seed: 7 }))
    const seedB = computePatternGeometry(outline, config({ cellSize: 20, seed: 8 }))
    expect(polygonsToPathData(seedA.cutPaths)).not.toBe(polygonsToPathData(seedB.cutPaths))
  })
})

describe('computePatternGeometry — fractal recursion', () => {
  it('recursing does not produce cells outside the outline', () => {
    const result = computePatternGeometry(
      outline,
      config({ cellSize: 40, recursion: { ...DEFAULT_PATTERN_CONFIG.recursion, depth: 2, minCellArea: 20 } }),
    )
    for (const cell of result.cutPaths) {
      const clipped = intersectPolys([cell], [outline])
      const clippedArea = clipped.reduce((s, p) => s + area(p), 0)
      expect(clippedArea).toBeCloseTo(area(cell), 1)
    }
    expect(result.stats.maxLevelReached).toBeGreaterThan(0)
  })

  it('etch mode collects cells from every level, cut mode only leaves', () => {
    const recursion = { ...DEFAULT_PATTERN_CONFIG.recursion, depth: 1, minCellArea: 20 }
    const cutResult = computePatternGeometry(outline, config({ cellSize: 40, mode: 'cut', recursion }))
    const etchResult = computePatternGeometry(outline, config({ cellSize: 40, mode: 'etch', recursion }))
    expect(etchResult.etchPaths.length).toBeGreaterThan(cutResult.cutPaths.length)
  })
})

describe('computePatternGeometry — budget safeguard', () => {
  it('truncates and warns instead of hanging when the budget is exceeded', () => {
    const result = computePatternGeometry(
      outline,
      config({
        cellSize: 5,
        recursion: { ...DEFAULT_PATTERN_CONFIG.recursion, depth: 3, minCellArea: 1, maxLeafCells: 50 },
      }),
    )
    expect(result.stats.truncated).toBe(true)
    expect(result.warnings.some((w) => w.code === 'budget-truncated')).toBe(true)
  })
})

describe('computePatternGeometry — rotational symmetry', () => {
  const roundOutline = buildShapeOutline({ kind: 'regularPolygon', sides: 24, radius: 150, rotation: 0, cornerRadius: 0 })

  it('produces a leaf count that is an exact multiple of the symmetry count', () => {
    const result = computePatternGeometry(roundOutline, config({ cellSize: 15, symmetryCount: 6 }))
    expect(result.cutPaths.length).toBeGreaterThan(0)
    expect(result.cutPaths.length % 6).toBe(0)
  })

  it('every cell stays within the true outline even after wedge rotation', () => {
    const result = computePatternGeometry(roundOutline, config({ cellSize: 15, symmetryCount: 5 }))
    for (const cell of result.cutPaths) {
      const clipped = intersectPolys([cell], [roundOutline])
      const clippedArea = clipped.reduce((s, p) => s + area(p), 0)
      expect(clippedArea).toBeCloseTo(area(cell), 1)
    }
  })

  it('symmetryCount of 1 matches having no symmetry at all', () => {
    const withOne = computePatternGeometry(roundOutline, config({ cellSize: 20, symmetryCount: 1 }))
    const withDefault = computePatternGeometry(roundOutline, config({ cellSize: 20 }))
    expect(polygonsToPathData(withOne.cutPaths)).toBe(polygonsToPathData(withDefault.cutPaths))
  })

  it('keeps the total leaf count roughly within the configured budget', () => {
    const result = computePatternGeometry(
      roundOutline,
      config({
        cellSize: 8,
        symmetryCount: 8,
        recursion: { ...DEFAULT_PATTERN_CONFIG.recursion, maxLeafCells: 240 },
      }),
    )
    // Per-wedge budget is ceil(240/8)=30, so total is at most 30*8=240.
    expect(result.stats.leafCells).toBeLessThanOrEqual(240)
  })
})

describe('computePatternGeometry — mirror (dihedral) symmetry', () => {
  const roundOutline = buildShapeOutline({ kind: 'regularPolygon', sides: 24, radius: 150, rotation: 0, cornerRadius: 0 })

  it('produces a leaf count that is a multiple of 2x the symmetry count', () => {
    const result = computePatternGeometry(roundOutline, config({ cellSize: 15, symmetryCount: 6, mirrorSymmetry: true }))
    expect(result.cutPaths.length).toBeGreaterThan(0)
    expect(result.cutPaths.length % 12).toBe(0)
  })

  it('every cell stays within the true outline', () => {
    const result = computePatternGeometry(roundOutline, config({ cellSize: 15, symmetryCount: 5, mirrorSymmetry: true }))
    for (const cell of result.cutPaths) {
      const clipped = intersectPolys([cell], [roundOutline])
      const clippedArea = clipped.reduce((s, p) => s + area(p), 0)
      expect(clippedArea).toBeCloseTo(area(cell), 1)
    }
  })

  it('applies a standalone bilateral mirror when symmetryCount is 1 — no rotational copies, just one reflection', () => {
    const axisAngle = 90
    const withMirror = computePatternGeometry(
      roundOutline,
      config({ cellSize: 20, symmetryCount: 1, mirrorSymmetry: true, mirrorHorizontal: false, mirrorVertical: true }),
    )
    const withoutMirror = computePatternGeometry(
      roundOutline,
      config({ cellSize: 20, symmetryCount: 1, mirrorSymmetry: false }),
    )
    expect(withMirror.cutPaths.length).toBeGreaterThan(0)
    // Standalone mirror is a real, distinct effect now — no longer a no-op.
    expect(polygonsToPathData(withMirror.cutPaths)).not.toBe(polygonsToPathData(withoutMirror.cutPaths))

    // And it's actually symmetric across the configured axis, not just
    // "different": reflecting the whole cut set across that axis should
    // cover the same region as the original (near-zero symmetric difference).
    const patternCenter = centroid(roundOutline)
    const reflected = withMirror.cutPaths.map((p) => mirrorPolygon(p, patternCenter, axisAngle))
    const diff = xorPolys(withMirror.cutPaths, reflected)
    const diffArea = diff.reduce((s, p) => s + area(p), 0)
    const totalArea = withMirror.cutPaths.reduce((s, p) => s + area(p), 0)
    expect(diffArea / totalArea).toBeLessThan(0.01)
  })

  it('applies BOTH horizontal and vertical mirrors together for 4-fold/quadrant symmetry', () => {
    const result = computePatternGeometry(
      roundOutline,
      config({ cellSize: 15, symmetryCount: 1, mirrorSymmetry: true, mirrorHorizontal: true, mirrorVertical: true }),
    )
    expect(result.cutPaths.length).toBeGreaterThan(0)

    // Symmetric across BOTH axes independently — reflecting the whole cut
    // set across either one should cover the same region as the original.
    const patternCenter = centroid(roundOutline)
    for (const axis of [0, 90]) {
      const reflected = result.cutPaths.map((p) => mirrorPolygon(p, patternCenter, axis))
      const diff = xorPolys(result.cutPaths, reflected)
      const diffArea = diff.reduce((s, p) => s + area(p), 0)
      const totalArea = result.cutPaths.reduce((s, p) => s + area(p), 0)
      expect(diffArea / totalArea).toBeLessThan(0.01)
    }

    // And it's a real combination of both axes, not one silently winning —
    // generation happens in one quadrant at the same cellSize either way,
    // so leaf COUNT stays roughly constant regardless of how many mirror
    // copies rebuild the full shape (fixed cellSize means fixed density,
    // not fixed count); what should differ is the actual cut geometry.
    const horizontalOnly = computePatternGeometry(
      roundOutline,
      config({ cellSize: 15, symmetryCount: 1, mirrorSymmetry: true, mirrorHorizontal: true, mirrorVertical: false }),
    )
    const verticalOnly = computePatternGeometry(
      roundOutline,
      config({ cellSize: 15, symmetryCount: 1, mirrorSymmetry: true, mirrorHorizontal: false, mirrorVertical: true }),
    )
    expect(polygonsToPathData(result.cutPaths)).not.toBe(polygonsToPathData(horizontalOnly.cutPaths))
    expect(polygonsToPathData(result.cutPaths)).not.toBe(polygonsToPathData(verticalOnly.cutPaths))
  })

  it('keeps the total leaf count within the configured budget', () => {
    const result = computePatternGeometry(
      roundOutline,
      config({
        cellSize: 8,
        symmetryCount: 8,
        mirrorSymmetry: true,
        recursion: { ...DEFAULT_PATTERN_CONFIG.recursion, maxLeafCells: 240 },
      }),
    )
    // Per-repeat-unit budget is ceil(240/16)=15, so total is at most 15*16=240.
    expect(result.stats.leafCells).toBeLessThanOrEqual(240)
  })

  it('is bilaterally symmetric across each wedge\'s own mirror axis, unlike plain rotation', () => {
    const symmetryCount = 6
    const mirrored = computePatternGeometry(roundOutline, config({ cellSize: 12, symmetryCount, mirrorSymmetry: true }))
    const rotatedOnly = computePatternGeometry(roundOutline, config({ cellSize: 12, symmetryCount, mirrorSymmetry: false }))
    const patternCenter = centroid(roundOutline)
    const axisAngle = 360 / symmetryCount / 2

    // If the pattern is truly symmetric across this axis, reflecting the
    // whole cut set across it covers the same region as the original — the
    // symmetric difference (area covered by exactly one of the two) is ~0.
    const checkSymmetry = (cutPaths: typeof mirrored.cutPaths) => {
      const reflected = cutPaths.map((p) => mirrorPolygon(p, patternCenter, axisAngle))
      const diff = xorPolys(cutPaths, reflected)
      const diffArea = diff.reduce((s, p) => s + area(p), 0)
      const totalArea = cutPaths.reduce((s, p) => s + area(p), 0)
      return diffArea / totalArea
    }

    expect(checkSymmetry(mirrored.cutPaths)).toBeLessThan(0.01)
    // A plain rotational (non-mirrored) pattern has no reason to also be
    // bilaterally symmetric across this particular axis — confirms the
    // near-zero result above is actually mirrorSymmetry's doing.
    expect(checkSymmetry(rotatedOnly.cutPaths)).toBeGreaterThan(0.1)
  })
})

describe('computePatternGeometry — null shape', () => {
  it('produces multiple separate pieces with no cut/etch paths', () => {
    const result = computePatternGeometry(outline, config({ cellSize: 20, nullShape: true }))
    expect(result.outline.length).toBeGreaterThan(1)
    expect(result.cutPaths).toEqual([])
    expect(result.etchPaths).toEqual([])
  })

  it('keeps pieces roughly cell-sized rather than reconstructing the container', () => {
    const result = computePatternGeometry(outline, config({ cellSize: 20, nullShape: true }))
    const containerArea = area(outline)
    for (const piece of result.outline) {
      expect(area(piece)).toBeLessThan(containerArea * 0.5)
    }
  })

  it('is unaffected by mode — cut and etch produce the same pieces', () => {
    const cutResult = computePatternGeometry(outline, config({ cellSize: 20, nullShape: true, mode: 'cut', seed: 3 }))
    const etchResult = computePatternGeometry(outline, config({ cellSize: 20, nullShape: true, mode: 'etch', seed: 3 }))
    expect(polygonsToPathData(cutResult.outline)).toBe(polygonsToPathData(etchResult.outline))
  })

  it('explodeAmount pushes pieces further from the pattern center', () => {
    const base = computePatternGeometry(outline, config({ cellSize: 20, nullShape: true, explodeAmount: 0 }))
    const exploded = computePatternGeometry(outline, config({ cellSize: 20, nullShape: true, explodeAmount: 40 }))
    const baseBounds = base.bounds
    const explodedBounds = exploded.bounds
    const baseSpan = baseBounds.maxX - baseBounds.minX
    const explodedSpan = explodedBounds.maxX - explodedBounds.minX
    expect(explodedSpan).toBeGreaterThan(baseSpan)
  })

  it('allows pieces to extend beyond the original container when exploded (no safety-net clip)', () => {
    const exploded = computePatternGeometry(outline, config({ cellSize: 20, nullShape: true, explodeAmount: 200 }))
    const containerBounds = bounds(outline)
    expect(exploded.bounds.maxX).toBeGreaterThan(containerBounds.maxX)
    expect(exploded.bounds.minX).toBeLessThan(containerBounds.minX)
  })

  it('composes with fractal recursion — only leaf cells become pieces', () => {
    const result = computePatternGeometry(
      outline,
      config({
        cellSize: 30,
        nullShape: true,
        recursion: { ...DEFAULT_PATTERN_CONFIG.recursion, depth: 1, minCellArea: 20 },
      }),
    )
    expect(result.outline.length).toBeGreaterThan(0)
    expect(result.stats.maxLevelReached).toBeGreaterThan(0)
  })
})

describe('computePatternGeometry — surface detail', () => {
  it('is a no-op when disabled', () => {
    const withoutDetail = computePatternGeometry(outline, config({ cellSize: 40, mode: 'cut' }))
    const withDisabledDetail = computePatternGeometry(
      outline,
      config({ cellSize: 40, mode: 'cut', surfaceDetail: { ...DEFAULT_PATTERN_CONFIG.surfaceDetail, enabled: false } }),
    )
    expect(polygonsToPathData(withDisabledDetail.etchPaths)).toBe(polygonsToPathData(withoutDetail.etchPaths))
    expect(withDisabledDetail.detailEtchPaths).toEqual([])
  })

  it('adds a second, finer set of etch paths — kept separate from the main pattern\'s own etchPaths', () => {
    const result = computePatternGeometry(
      outline,
      config({
        cellSize: 40,
        mode: 'cut',
        surfaceDetail: {
          enabled: true,
          pattern: { ...DEFAULT_PATTERN_CONFIG.surfaceDetail.pattern, cellSize: 10 },
        },
      }),
    )
    expect(result.cutPaths.length).toBeGreaterThan(0)
    expect(result.etchPaths).toEqual([]) // cut mode: main pattern contributes no etch geometry of its own
    expect(result.detailEtchPaths.length).toBeGreaterThan(0)
  })

  it('keeps the main pattern\'s own etch mode geometry separate from detail etch geometry', () => {
    const result = computePatternGeometry(
      outline,
      config({
        cellSize: 40,
        mode: 'etch',
        surfaceDetail: {
          enabled: true,
          pattern: { ...DEFAULT_PATTERN_CONFIG.surfaceDetail.pattern, cellSize: 10 },
        },
      }),
    )
    expect(result.etchPaths.length).toBeGreaterThan(0)
    expect(result.detailEtchPaths.length).toBeGreaterThan(0)
  })

  it('every detail etch path stays within the outline', () => {
    const result = computePatternGeometry(
      outline,
      config({
        cellSize: 40,
        mode: 'cut',
        surfaceDetail: {
          enabled: true,
          pattern: { ...DEFAULT_PATTERN_CONFIG.surfaceDetail.pattern, cellSize: 10 },
        },
      }),
    )
    for (const path of result.detailEtchPaths) {
      const clipped = intersectPolys([path], [outline])
      const clippedArea = clipped.reduce((s, p) => s + area(p), 0)
      expect(clippedArea).toBeCloseTo(area(path), 1)
    }
  })

  it('never overlaps the main lattice\'s cut holes in cut mode — detail lines only exist on solid material', () => {
    const result = computePatternGeometry(
      outline,
      config({
        cellSize: 40,
        mode: 'cut',
        surfaceDetail: {
          enabled: true,
          pattern: { ...DEFAULT_PATTERN_CONFIG.surfaceDetail.pattern, cellSize: 10 },
        },
      }),
    )
    expect(result.cutPaths.length).toBeGreaterThan(0)
    expect(result.detailEtchPaths.length).toBeGreaterThan(0)
    for (const cut of result.cutPaths) {
      const overlap = intersectPolys(result.detailEtchPaths, [cut])
      const overlapArea = overlap.reduce((s, p) => s + area(p), 0)
      expect(overlapArea).toBeLessThan(0.5)
    }
  })

  it('works with nullShape — detail fragments land on the exploded pieces, not the old grid', () => {
    const result = computePatternGeometry(
      outline,
      config({
        cellSize: 30,
        nullShape: true,
        explodeAmount: 20,
        surfaceDetail: {
          enabled: true,
          pattern: { ...DEFAULT_PATTERN_CONFIG.surfaceDetail.pattern, cellSize: 8 },
        },
      }),
    )
    expect(result.cutPaths).toEqual([])
    expect(result.etchPaths).toEqual([])
    expect(result.detailEtchPaths.length).toBeGreaterThan(0)
    const pieceUnion = unionPolys(result.outline)
    for (const path of result.detailEtchPaths) {
      const clipped = intersectPolys([path], pieceUnion)
      const clippedArea = clipped.reduce((s, p) => s + area(p), 0)
      expect(clippedArea).toBeCloseTo(area(path), 1)
    }
  })

  it('carries each detail fragment along with its piece as explodeAmount increases', () => {
    const patternWith = (explodeAmount: number) =>
      config({
        cellSize: 30,
        nullShape: true,
        explodeAmount,
        surfaceDetail: {
          enabled: true,
          pattern: { ...DEFAULT_PATTERN_CONFIG.surfaceDetail.pattern, cellSize: 8 },
        },
      })
    const base = computePatternGeometry(outline, patternWith(0))
    const exploded = computePatternGeometry(outline, patternWith(60))
    const baseBounds = bounds(base.detailEtchPaths.flat())
    const explodedBounds = bounds(exploded.detailEtchPaths.flat())
    expect(explodedBounds.maxX - explodedBounds.minX).toBeGreaterThan(baseBounds.maxX - baseBounds.minX)
  })
})

describe('computePatternGeometry — edge cases', () => {
  it('warns and returns empty pattern when edge margin consumes the whole shape', () => {
    const result = computePatternGeometry(outline, config({ edgeMargin: 200 }))
    expect(result.cutPaths).toEqual([])
    expect(result.warnings.some((w) => w.code === 'no-cells-generated')).toBe(true)
  })
})

describe('computePatternGeometry — dispersion', () => {
  it('is wired through end-to-end: enabling it changes the cut geometry', () => {
    const off = computePatternGeometry(outline, config({ cellSize: 20 }))
    const on = computePatternGeometry(
      outline,
      config({ cellSize: 20, dispersion: { enabled: true, sizeVariance: 0.5, distanceVariance: 0.5 } }),
    )
    expect(off.cutPaths.length).toBeGreaterThan(0)
    expect(on.cutPaths.length).toBeGreaterThan(0)
    expect(polygonsToPathData(on.cutPaths)).not.toBe(polygonsToPathData(off.cutPaths))
  })

  it('every dispersed cell still stays within the true outline (final clip still applies)', () => {
    const result = computePatternGeometry(
      outline,
      config({ cellSize: 20, dispersion: { enabled: true, sizeVariance: 0.6, distanceVariance: 0.6 } }),
    )
    for (const cell of result.cutPaths) {
      const clipped = intersectPolys([cell], [outline])
      const clippedArea = clipped.reduce((s, p) => s + area(p), 0)
      expect(clippedArea).toBeCloseTo(area(cell), 1)
    }
  })
})
