import { describe, expect, it } from 'vitest'
import { summarizeNumeric, summarizeCategorical } from './insights'
import { DEFAULT_PATTERN_CONFIG } from './geometry/constants'
import type { RatingEntry } from '../store/ratingsStore'
import type { ShapePrimitive } from './geometry/types'

const shape: ShapePrimitive = { kind: 'rect', width: 200, height: 200, cornerRadius: 0 }

function entry(overrides: { rating: RatingEntry['rating']; cellSize: number; kind?: RatingEntry['pattern']['kind'] }): RatingEntry {
  return {
    id: Math.random().toString(36),
    rating: overrides.rating,
    createdAt: new Date().toISOString(),
    componentName: 'Test',
    shape,
    pattern: { ...DEFAULT_PATTERN_CONFIG, cellSize: overrides.cellSize, kind: overrides.kind ?? DEFAULT_PATTERN_CONFIG.kind },
    centerHole: { enabled: false, shape, offsetX: 0, offsetY: 0, margin: 0, edgeDetail: DEFAULT_PATTERN_CONFIG.edgeDetail },
    stats: { leafCells: 10, totalCells: 10, cutAreaMm2: 100, materialAreaMm2: 200 },
  }
}

describe('summarizeNumeric', () => {
  it('computes min/max/mean/count per param path across entries', () => {
    const entries = [entry({ rating: 'good', cellSize: 10 }), entry({ rating: 'good', cellSize: 20 }), entry({ rating: 'ok', cellSize: 30 })]
    const stats = summarizeNumeric(entries)
    const cellSize = stats.find((s) => s.path === 'pattern.cellSize')
    expect(cellSize).toBeDefined()
    expect(cellSize!.count).toBe(3)
    expect(cellSize!.min).toBe(10)
    expect(cellSize!.max).toBe(30)
    expect(cellSize!.mean).toBe(20)
  })

  it('skips array-valued leaves (e.g. freeform shape points)', () => {
    const freeform: ShapePrimitive = { kind: 'freeform', points: [{ x: 0, y: 0, hx: 0, hy: 0 }] }
    const e = { ...entry({ rating: 'good', cellSize: 10 }), shape: freeform }
    const stats = summarizeNumeric([e])
    expect(stats.some((s) => s.path.startsWith('shape.points'))).toBe(false)
  })

  it('returns an empty list for no entries', () => {
    expect(summarizeNumeric([])).toEqual([])
  })
})

describe('summarizeCategorical', () => {
  it('tallies frequency of enum/boolean leaves per path', () => {
    const entries = [
      entry({ rating: 'good', cellSize: 10, kind: 'voronoi' }),
      entry({ rating: 'good', cellSize: 20, kind: 'voronoi' }),
      entry({ rating: 'ok', cellSize: 30, kind: 'hexagon' }),
    ]
    const stats = summarizeCategorical(entries)
    const kind = stats.find((s) => s.path === 'pattern.kind')
    expect(kind).toBeDefined()
    expect(kind!.counts).toEqual({ voronoi: 2, hexagon: 1 })
  })

  it('excludes numeric leaves', () => {
    const stats = summarizeCategorical([entry({ rating: 'good', cellSize: 10 })])
    expect(stats.some((s) => s.path === 'pattern.cellSize')).toBe(false)
  })
})
