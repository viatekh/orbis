import { describe, expect, it } from 'vitest'
import { randomizeShapeFully, randomizePatternFully } from './randomize'
import { SHAPE_OPTIONS } from './shapeDefaults'
import { KIND_ORDER } from './PatternKindPicker'
import { DEFAULT_PATTERN_CONFIG } from '../../lib/geometry/constants'

// Regression for "Randomize all barely changes the shape" — randomizeShape
// (used by the per-panel button) deliberately keeps kind stable, which is
// right for that button but meant "Randomize all" inherited the same
// limitation. These *Fully variants exist specifically to vary kind too.
describe('randomizeShapeFully', () => {
  it('produces more than one distinct shape kind across many calls', () => {
    const kinds = new Set(Array.from({ length: 60 }, () => randomizeShapeFully().kind))
    expect(kinds.size).toBeGreaterThan(1)
  })

  it('only ever produces kinds from the real shape option list', () => {
    const valid = new Set(SHAPE_OPTIONS.map((o) => o.value))
    for (let i = 0; i < 30; i++) {
      expect(valid.has(randomizeShapeFully().kind)).toBe(true)
    }
  })
})

describe('randomizePatternFully', () => {
  it('produces more than one distinct pattern kind across many calls', () => {
    const kinds = new Set(Array.from({ length: 60 }, () => randomizePatternFully(DEFAULT_PATTERN_CONFIG).kind))
    expect(kinds.size).toBeGreaterThan(1)
  })

  it('only ever produces kinds from the real pattern kind list', () => {
    const valid = new Set(KIND_ORDER)
    for (let i = 0; i < 30; i++) {
      expect(valid.has(randomizePatternFully(DEFAULT_PATTERN_CONFIG).kind)).toBe(true)
    }
  })
})
