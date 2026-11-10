import { describe, expect, it } from 'vitest'
import {
  computeGridTransforms,
  computeInstanceTransforms,
  computeManualTransforms,
  computePlacementTransforms,
  computeRadialTransforms,
  projectToPlane,
  scaleGenerator,
  transformPolygon,
} from './instanceTransform'
import type { RadialPlacement } from './instanceTransform'
import type { GridGenerator, Instance3D, ManualGenerator, RadialGenerator } from './types'

function layer(overrides: Partial<RadialPlacement> = {}): RadialPlacement {
  return {
    count: 4,
    radius: 100,
    startAngle: 0,
    arcSpan: 360,
    autoOrient: false,
    instanceRotation: 0,
    alternateMirror: false,
    ...overrides,
  }
}

function radialGenerator(overrides: Partial<RadialGenerator> = {}): RadialGenerator {
  return { kind: 'radial', ...layer(), tiltDeg: 0, swivelDeg: 0, axis: 'z', ...overrides }
}

function gridGenerator(overrides: Partial<GridGenerator> = {}): GridGenerator {
  return { kind: 'grid', rows: 2, cols: 3, spacingX: 100, spacingY: 50, staggerOffset: 0, tiltDeg: 0, swivelDeg: 0, ...overrides }
}

function manualGenerator(overrides: Partial<ManualGenerator> = {}): ManualGenerator {
  return { kind: 'manual', instances: [{ x: 1, y: 2, z: 3, rotationX: 4, rotationY: 5, rotationZ: 6, mirrored: true }], ...overrides }
}

describe('computeInstanceTransforms', () => {
  it('distributes a full circle without duplicating the seam', () => {
    const t = computeInstanceTransforms(layer({ count: 4, arcSpan: 360 }))
    expect(t).toHaveLength(4)
    expect(t[0].x).toBeCloseTo(100)
    expect(t[0].y).toBeCloseTo(0)
    expect(t[1].x).toBeCloseTo(0, 5)
    expect(t[1].y).toBeCloseTo(100)
    expect(t[2].x).toBeCloseTo(-100)
    expect(t[3].y).toBeCloseTo(-100)
  })

  it('distributes a partial arc across both endpoints inclusive', () => {
    const t = computeInstanceTransforms(layer({ count: 3, arcSpan: 180, startAngle: 0 }))
    expect(t).toHaveLength(3)
    // 0deg, 90deg, 180deg — step = span/(count-1)
    expect(t[0].x).toBeCloseTo(100)
    expect(t[1].y).toBeCloseTo(100)
    expect(t[2].x).toBeCloseTo(-100)
  })

  it('does not divide by zero for a single instance', () => {
    const t = computeInstanceTransforms(layer({ count: 1, arcSpan: 180, startAngle: 45 }))
    expect(t).toHaveLength(1)
    expect(t[0].x).toBeCloseTo(100 * Math.cos((45 * Math.PI) / 180))
  })

  it('auto-orient rotates each instance to its placement angle plus the manual offset', () => {
    const t = computeInstanceTransforms(layer({ count: 4, arcSpan: 360, autoOrient: true, instanceRotation: 90 }))
    expect(t[0].rotationDeg).toBeCloseTo(90) // angle 0 + offset 90
    expect(t[1].rotationDeg).toBeCloseTo(180) // angle 90 + offset 90
  })

  it('fixed orientation ignores placement angle entirely', () => {
    const t = computeInstanceTransforms(layer({ count: 4, arcSpan: 360, autoOrient: false, instanceRotation: 15 }))
    for (const inst of t) expect(inst.rotationDeg).toBeCloseTo(15)
  })

  it('alternate mirror flips only odd indices', () => {
    const t = computeInstanceTransforms(layer({ count: 4, alternateMirror: true }))
    expect(t[0].mirrored).toBe(false)
    expect(t[1].mirrored).toBe(true)
    expect(t[2].mirrored).toBe(false)
    expect(t[3].mirrored).toBe(true)
  })
})

describe('transformPolygon', () => {
  const point = [{ x: 1, y: 0 }]

  it('rotates around the origin', () => {
    const [p] = transformPolygon(point, { x: 0, y: 0, rotationDeg: 90, mirrored: false })
    expect(p.x).toBeCloseTo(0, 5)
    expect(p.y).toBeCloseTo(1)
  })

  it('translates', () => {
    const [p] = transformPolygon(point, { x: 10, y: 20, rotationDeg: 0, mirrored: false })
    expect(p.x).toBeCloseTo(11)
    expect(p.y).toBeCloseTo(20)
  })

  it('mirrors before rotating', () => {
    const [p] = transformPolygon(point, { x: 0, y: 0, rotationDeg: 0, mirrored: true })
    expect(p.x).toBeCloseTo(-1)
    expect(p.y).toBeCloseTo(0)
  })
})

describe('computeRadialTransforms', () => {
  it('matches computeInstanceTransforms for a flat (axis "z") ring', () => {
    const flat = computeInstanceTransforms(layer({ count: 4, autoOrient: true, instanceRotation: 5 }))
    const t = computeRadialTransforms(radialGenerator({ count: 4, autoOrient: true, instanceRotation: 5 }))
    expect(t).toHaveLength(4)
    t.forEach((inst, i) => {
      expect(inst.x).toBeCloseTo(flat[i].x)
      expect(inst.y).toBeCloseTo(flat[i].y)
      expect(inst.z).toBeCloseTo(0)
      expect(inst.rotationZ).toBeCloseTo(flat[i].rotationDeg)
      expect(inst.mirrored).toBe(flat[i].mirrored)
    })
  })

  it('stands the ring up into the YZ plane when axis is "x"', () => {
    const t = computeRadialTransforms(radialGenerator({ count: 1, startAngle: 0, radius: 100, axis: 'x' }))
    expect(t[0].x).toBeCloseTo(0)
    expect(t[0].y).toBeCloseTo(100)
    expect(t[0].z).toBeCloseTo(0)
  })

  it('stands the ring up into the XZ plane when axis is "y"', () => {
    const t = computeRadialTransforms(radialGenerator({ count: 1, startAngle: 0, radius: 100, axis: 'y' }))
    expect(t[0].x).toBeCloseTo(100)
    expect(t[0].y).toBeCloseTo(0)
    expect(t[0].z).toBeCloseTo(0)
  })

  it('stores tiltDeg verbatim as rotationX, and swivelDeg verbatim as rotationY, independently', () => {
    const t = computeRadialTransforms(radialGenerator({ count: 3, tiltDeg: 30, swivelDeg: -15 }))
    for (const inst of t) {
      expect(inst.rotationX).toBeCloseTo(30)
      expect(inst.rotationY).toBeCloseTo(-15)
    }
  })
})

describe('computeGridTransforms', () => {
  it('lays out rows×cols at the given spacing', () => {
    const t = computeGridTransforms(gridGenerator({ rows: 2, cols: 3, spacingX: 100, spacingY: 50, staggerOffset: 0 }))
    expect(t).toHaveLength(6)
    expect(t[0]).toMatchObject({ x: 0, y: 0, z: 0 })
    expect(t[2]).toMatchObject({ x: 200, y: 0, z: 0 }) // last column, first row
    expect(t[3]).toMatchObject({ x: 0, y: 50, z: 0 }) // first column, second row
  })

  it('offsets alternating rows by staggerOffset', () => {
    const t = computeGridTransforms(gridGenerator({ rows: 2, cols: 1, staggerOffset: 25 }))
    expect(t[0].x).toBeCloseTo(0)
    expect(t[1].x).toBeCloseTo(25)
  })

  it('produces no rotation or mirroring by default', () => {
    const t = computeGridTransforms(gridGenerator())
    for (const inst of t) {
      expect(inst.rotationX).toBe(0)
      expect(inst.rotationY).toBe(0)
      expect(inst.rotationZ).toBe(0)
      expect(inst.mirrored).toBe(false)
    }
  })

  it('applies tiltDeg/swivelDeg verbatim as rotationX/rotationY on every tile', () => {
    const t = computeGridTransforms(gridGenerator({ rows: 2, cols: 2, tiltDeg: 20, swivelDeg: 10 }))
    for (const inst of t) {
      expect(inst.rotationX).toBeCloseTo(20)
      expect(inst.rotationY).toBeCloseTo(10)
    }
  })
})

describe('computeManualTransforms', () => {
  it('returns the authored instances verbatim', () => {
    const gen = manualGenerator()
    expect(computeManualTransforms(gen)).toBe(gen.instances)
  })
})

describe('computePlacementTransforms', () => {
  it('dispatches to the matching generator', () => {
    expect(computePlacementTransforms(radialGenerator({ count: 2 }))).toHaveLength(2)
    expect(computePlacementTransforms(gridGenerator({ rows: 2, cols: 2 }))).toHaveLength(4)
    expect(computePlacementTransforms(manualGenerator())).toHaveLength(1)
  })
})

describe('projectToPlane', () => {
  it('keeps x/y/mirrored and maps rotationZ to rotationDeg, dropping z/rotationX/rotationY', () => {
    const instance: Instance3D = { x: 1, y: 2, z: 3, rotationX: 4, rotationY: 5, rotationZ: 6, mirrored: true }
    expect(projectToPlane(instance)).toEqual({ x: 1, y: 2, rotationDeg: 6, mirrored: true })
  })
})

describe('scaleGenerator', () => {
  it('is a no-op at factor 1', () => {
    const gen = radialGenerator()
    expect(scaleGenerator(gen, 1)).toBe(gen)
  })

  it("scales a radial generator's radius, leaves count/angles/tilt/swivel/axis untouched", () => {
    const gen = radialGenerator({ count: 5, radius: 100, startAngle: 15, arcSpan: 270, tiltDeg: 20, swivelDeg: -10, axis: 'x' })
    const scaled = scaleGenerator(gen, 3)
    expect(scaled).toEqual({ ...gen, radius: 300 })
  })

  it("scales a grid generator's spacingX/spacingY/staggerOffset, leaves rows/cols/tilt/swivel untouched", () => {
    const gen = gridGenerator({ rows: 4, cols: 5, spacingX: 100, spacingY: 50, staggerOffset: 20, tiltDeg: 15, swivelDeg: -5 })
    const scaled = scaleGenerator(gen, 2)
    expect(scaled).toEqual({ ...gen, spacingX: 200, spacingY: 100, staggerOffset: 40 })
  })

  it("scales each manual instance's x/y/z, leaves rotation fields and mirrored untouched", () => {
    const gen = manualGenerator({
      instances: [{ x: 10, y: -20, z: 5, rotationX: 1, rotationY: 2, rotationZ: 3, mirrored: true }],
    })
    const scaled = scaleGenerator(gen, 0.5)
    expect(scaled).toEqual({
      kind: 'manual',
      instances: [{ x: 5, y: -10, z: 2.5, rotationX: 1, rotationY: 2, rotationZ: 3, mirrored: true }],
    })
  })
})
