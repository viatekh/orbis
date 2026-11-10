import { describe, expect, it } from 'vitest'
import { combineInstances } from './booleanCombine'
import { area } from './polygon'
import type { CombineInstance } from './booleanCombine'
import type { Polygon } from './types'

function rect(x0: number, y0: number, x1: number, y1: number): Polygon {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function instance(
  outline: Polygon,
  cutPaths: Polygon[] = [],
  etchPaths: Polygon[] = [],
  detailEtchPaths: Polygon[] = [],
): CombineInstance {
  return { outline: [outline], cutPaths, etchPaths, detailEtchPaths }
}

function totalArea(polys: Polygon[]): number {
  return polys.reduce((sum, p) => sum + area(p), 0)
}

// A: [0,10]x[0,10]  B: [5,15]x[0,10] — overlap is [5,10]x[0,10], area 50.
const A = rect(0, 0, 10, 10)
const B = rect(5, 0, 15, 10)

describe('combineInstances — passthrough', () => {
  it('returns instances unchanged for a single instance', () => {
    const result = combineInstances('union', [instance(A, [rect(1, 1, 2, 2)])], false)
    expect(result.outline).toEqual([A])
    expect(result.cutPaths).toEqual([rect(1, 1, 2, 2)])
  })

  it('returns instances unchanged (independent) when mode is none', () => {
    const result = combineInstances('none', [instance(A), instance(B)], false)
    expect(result.outline).toEqual([A, B])
  })
})

describe('combineInstances — union', () => {
  it('fills a hole that falls within another instance\'s solid material', () => {
    const holeInOverlap = rect(6, 4, 8, 6) // inside both A and B's overlap zone
    const result = combineInstances('union', [instance(A, [holeInOverlap]), instance(B)], false)
    expect(totalArea(result.outline)).toBeCloseTo(150) // union of A and B
    expect(totalArea(result.cutPaths)).toBeCloseTo(0) // B's solid material fills A's hole
  })

  it('preserves a hole that no other instance covers', () => {
    const holeOutsideB = rect(1, 1, 3, 3) // x in [1,3], entirely outside B (starts at x=5)
    const result = combineInstances('union', [instance(A, [holeOutsideB]), instance(B)], false)
    expect(totalArea(result.outline)).toBeCloseTo(150)
    expect(totalArea(result.cutPaths)).toBeCloseTo(4)
  })
})

describe('combineInstances — subtract', () => {
  it('punches the later instance\'s full silhouette out of the base', () => {
    const result = combineInstances('subtract', [instance(A), instance(B)], false)
    expect(totalArea(result.outline)).toBeCloseTo(50) // [0,5]x[0,10], the non-overlapping part of A
  })

  it('preserves the base\'s own hole if it survives outside the subtracted region', () => {
    const holeInSurvivor = rect(1, 1, 3, 3) // within the surviving [0,5]x[0,10] strip
    const result = combineInstances('subtract', [instance(A, [holeInSurvivor]), instance(B)], false)
    expect(totalArea(result.outline)).toBeCloseTo(50)
    expect(totalArea(result.cutPaths)).toBeCloseTo(4)
  })

  it('discards a hole that falls inside the subtracted-away region', () => {
    const holeInRemovedRegion = rect(6, 1, 8, 3) // within [5,10]x[0,10], which gets punched away
    const result = combineInstances('subtract', [instance(A, [holeInRemovedRegion]), instance(B)], false)
    expect(totalArea(result.outline)).toBeCloseTo(50)
    expect(totalArea(result.cutPaths)).toBeCloseTo(0)
  })
})

describe('combineInstances — intersect', () => {
  it('keeps only the common region when neither instance has a hole there', () => {
    const result = combineInstances('intersect', [instance(A), instance(B)], false)
    expect(totalArea(result.outline)).toBeCloseTo(50) // [5,10]x[0,10]
    expect(totalArea(result.cutPaths)).toBeCloseTo(0)
  })

  it('fills a hole in the overlap if only one instance has it there', () => {
    const holeInOverlap = rect(6, 4, 8, 6)
    const result = combineInstances('intersect', [instance(A, [holeInOverlap]), instance(B)], false)
    expect(totalArea(result.cutPaths)).toBeCloseTo(0) // B has solid material there
  })

  it('preserves a hole shared by every instance at the same spot', () => {
    const sharedHole = rect(6, 4, 8, 6)
    const result = combineInstances('intersect', [instance(A, [sharedHole]), instance(B, [sharedHole])], false)
    expect(totalArea(result.cutPaths)).toBeCloseTo(4)
  })
})

describe('combineInstances — exclude', () => {
  it('removes the overlap region, leaving the non-overlapping parts as separate pieces', () => {
    const result = combineInstances('exclude', [instance(A), instance(B)], false)
    expect(totalArea(result.outline)).toBeCloseTo(100) // 150 total minus the 50 overlap, removed twice over
    expect(totalArea(result.cutPaths)).toBeCloseTo(0)
  })
})

describe('combineInstances — etch mode', () => {
  it('never produces cut paths', () => {
    const result = combineInstances('subtract', [instance(A, [rect(1, 1, 2, 2)]), instance(B)], true)
    expect(result.cutPaths).toEqual([])
  })

  it('clips etch lines to the combined outline, dropping ones outside it', () => {
    const survivingEtch = rect(1, 1, 2, 2) // within the surviving [0,5]x[0,10] region under subtract
    const removedEtch = rect(6, 1, 7, 2) // within the subtracted-away [5,10]x[0,10] region
    const result = combineInstances(
      'subtract',
      [instance(A, [], [survivingEtch, removedEtch]), instance(B)],
      true,
    )
    expect(result.etchPaths.length).toBe(1)
    expect(totalArea(result.etchPaths)).toBeCloseTo(1)
  })
})
