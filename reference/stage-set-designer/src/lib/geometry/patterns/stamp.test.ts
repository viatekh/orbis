import { describe, expect, it } from 'vitest'
import { generateStampCells } from './stamp'
import { mulberry32 } from '../random'
import { DEFAULT_PATTERN_CONFIG } from '../constants'
import { buildShapeOutline } from '../shapes'
import { intersectPolys } from '../clipper'
import { area } from '../polygon'
import type { PatternContext } from './types'
import type { PatternConfig, ShapePrimitive } from '../types'

const boundary = buildShapeOutline({ kind: 'regularPolygon', sides: 32, radius: 200, rotation: 0, cornerRadius: 0 })

function ctx(overrides: Partial<PatternConfig> = {}): PatternContext {
  const config: PatternConfig = {
    ...DEFAULT_PATTERN_CONFIG,
    kind: 'stamp',
    cellSize: 20,
    ...overrides,
    stamp: { ...DEFAULT_PATTERN_CONFIG.stamp, ...overrides.stamp },
  }
  return {
    boundary,
    origin: { x: 0, y: 0 },
    cellSize: config.cellSize,
    level: 0,
    rng: mulberry32(1),
    config,
    patternCenter: { x: 0, y: 0 },
    patternMaxRadius: 200,
  }
}

describe('generateStampCells', () => {
  it('produces cells clipped within the boundary', () => {
    const cells = generateStampCells(ctx())
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      const clipped = intersectPolys([cell], [boundary])
      const clippedArea = clipped.reduce((s, p) => s + area(p), 0)
      expect(clippedArea).toBeCloseTo(area(cell), 1)
    }
  })

  it('is deterministic across repeated calls (no RNG dependency)', () => {
    const a = generateStampCells(ctx())
    const b = generateStampCells(ctx())
    expect(a.length).toBe(b.length)
    expect(a[0]).toEqual(b[0])
  })

  it('places more rings/cells for a smaller ring spacing', () => {
    const sparse = generateStampCells(ctx({ stamp: { ...DEFAULT_PATTERN_CONFIG.stamp, ringSpacing: 60 } }))
    const dense = generateStampCells(ctx({ stamp: { ...DEFAULT_PATTERN_CONFIG.stamp, ringSpacing: 20 } }))
    expect(dense.length).toBeGreaterThan(sparse.length)
  })

  it('changing the stamp shape changes cell vertex count', () => {
    const triangle: ShapePrimitive = { kind: 'regularPolygon', sides: 3, radius: 10, rotation: 0, cornerRadius: 0 }
    const star: ShapePrimitive = { kind: 'star', points: 5, radius: 10, innerRadiusRatio: 0.5, rotation: 0, cornerRadius: 0 }
    const triangleCells = generateStampCells(ctx({ stamp: { ...DEFAULT_PATTERN_CONFIG.stamp, shape: triangle } }))
    const starCells = generateStampCells(ctx({ stamp: { ...DEFAULT_PATTERN_CONFIG.stamp, shape: star } }))
    // A fully-interior triangle stamp has 3 vertices, a fully-interior star has 10 —
    // find at least one unclipped instance of each to compare shapes.
    const maxLen = (cells: ReturnType<typeof generateStampCells>) => Math.max(...cells.map((c) => c.length))
    expect(maxLen(starCells)).toBeGreaterThan(maxLen(triangleCells))
  })

  it('returns no cells when maxRadius is zero', () => {
    const context = { ...ctx(), patternMaxRadius: 0 }
    expect(generateStampCells(context)).toEqual([])
  })
})
