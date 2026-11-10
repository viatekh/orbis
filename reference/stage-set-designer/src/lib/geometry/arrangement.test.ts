import { describe, expect, it } from 'vitest'
import { computeArrangementGeometry } from './arrangement'
import { area } from './polygon'
import { DEFAULT_CENTER_HOLE_SHAPE, DEFAULT_EDGE_DETAIL, DEFAULT_PATTERN_CONFIG, DEFAULT_SHAPE } from './constants'
import type { Arrangement, ArrangementLayer, GridGenerator, ManualGenerator, RadialGenerator, StageComponent } from '../../types'

type LayerOverrides = Partial<Omit<ArrangementLayer, 'generator'>> & Partial<Omit<RadialGenerator, 'kind'>>

function layer(overrides: LayerOverrides = {}): ArrangementLayer {
  const { count, radius, startAngle, arcSpan, autoOrient, instanceRotation, alternateMirror, tiltDeg, swivelDeg, axis, ...layerFields } =
    overrides
  return {
    id: 'layer-1',
    name: 'Layer 1',
    componentId: 'comp-1',
    visible: true,
    combineMode: 'none',
    depth: 0,
    generator: {
      kind: 'radial',
      count: count ?? 4,
      radius: radius ?? 100,
      startAngle: startAngle ?? 0,
      arcSpan: arcSpan ?? 360,
      autoOrient: autoOrient ?? false,
      instanceRotation: instanceRotation ?? 0,
      alternateMirror: alternateMirror ?? false,
      tiltDeg: tiltDeg ?? 0,
      swivelDeg: swivelDeg ?? 0,
      axis: axis ?? 'z',
    },
    ...layerFields,
  }
}

function component(id: string, overrides: Partial<StageComponent> = {}): StageComponent {
  const now = new Date().toISOString()
  return {
    id,
    name: id,
    shape: { ...DEFAULT_SHAPE },
    pattern: structuredClone(DEFAULT_PATTERN_CONFIG),
    centerHole: {
      enabled: false,
      shape: { ...DEFAULT_CENTER_HOLE_SHAPE },
      offsetX: 0,
      offsetY: 0,
      margin: 0,
      edgeDetail: { ...DEFAULT_EDGE_DETAIL },
    },
    material: { thicknessMm: 6, label: 'Plywood' },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('computeArrangementGeometry', () => {
  it('unions bounds across visible layers', () => {
    const comp = component('comp-1')
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [layer({ id: 'l1', componentId: 'comp-1', radius: 100, count: 4 })],
      createdAt: '',
      updatedAt: '',
    }
    const geo = computeArrangementGeometry(arrangement, [comp])
    expect(geo.layers).toHaveLength(1)
    expect(geo.layers[0].outline).toHaveLength(4)
    expect(geo.bounds.maxX).toBeGreaterThan(0)
    expect(geo.bounds.minX).toBeLessThan(0)
  })

  it('produces no geometry for an invisible layer but does not throw', () => {
    const comp = component('comp-1')
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [layer({ id: 'l1', componentId: 'comp-1', visible: false })],
      createdAt: '',
      updatedAt: '',
    }
    const geo = computeArrangementGeometry(arrangement, [comp])
    expect(geo.layers[0].outline).toHaveLength(0)
    expect(geo.bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 })
  })

  it('skips a layer whose component no longer exists', () => {
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [layer({ id: 'l1', componentId: 'does-not-exist' })],
      createdAt: '',
      updatedAt: '',
    }
    expect(() => computeArrangementGeometry(arrangement, [])).not.toThrow()
    const geo = computeArrangementGeometry(arrangement, [])
    expect(geo.layers).toHaveLength(0)
  })

  it('leaves overlapping instances as separate polygons when combineMode is none', () => {
    // A large rect (300x200) with a tiny 2-instance array at a small radius
    // guarantees the two copies overlap heavily.
    const comp = component('comp-1', { shape: { kind: 'rect', width: 300, height: 200, cornerRadius: 0 } })
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [layer({ id: 'l1', componentId: 'comp-1', count: 2, radius: 20, combineMode: 'none' })],
      createdAt: '',
      updatedAt: '',
    }
    const geo = computeArrangementGeometry(arrangement, [comp])
    expect(geo.layers[0].outline).toHaveLength(2)
  })

  it('fuses overlapping instances into fewer polygons with less combined area under union mode', () => {
    const comp = component('comp-1', { shape: { kind: 'rect', width: 300, height: 200, cornerRadius: 0 } })
    const baseArrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [layer({ id: 'l1', componentId: 'comp-1', count: 2, radius: 20, combineMode: 'none' })],
      createdAt: '',
      updatedAt: '',
    }
    const unmerged = computeArrangementGeometry(baseArrangement, [comp])
    const unmergedArea = unmerged.layers[0].outline.reduce((s, p) => s + area(p), 0)

    const mergedArrangement: Arrangement = {
      ...baseArrangement,
      layers: [{ ...baseArrangement.layers[0], combineMode: 'union' }],
    }
    const merged = computeArrangementGeometry(mergedArrangement, [comp])
    const mergedArea = merged.layers[0].outline.reduce((s, p) => s + area(p), 0)

    expect(merged.layers[0].outline.length).toBeLessThan(unmerged.layers[0].outline.length)
    expect(mergedArea).toBeLessThan(unmergedArea)
  })

  it('places instances on a grid generator', () => {
    const comp = component('comp-1')
    const generator: GridGenerator = { kind: 'grid', rows: 2, cols: 3, spacingX: 150, spacingY: 150, staggerOffset: 0, tiltDeg: 0, swivelDeg: 0 }
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [{ ...layer({ id: 'l1', componentId: 'comp-1' }), generator }],
      createdAt: '',
      updatedAt: '',
    }
    const geo = computeArrangementGeometry(arrangement, [comp])
    expect(geo.layers[0].outline).toHaveLength(6)
    // Bottom-right instance sits (cols-1)*spacingX, (rows-1)*spacingY from
    // the first, so the bounds should span well past a single component.
    expect(geo.bounds.maxX - geo.bounds.minX).toBeGreaterThan(300)
  })

  it('places instances on a manual generator, ignoring z/tilt for the flat cut geometry', () => {
    const comp = component('comp-1')
    const generator: ManualGenerator = {
      kind: 'manual',
      instances: [
        { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, mirrored: false },
        { x: 500, y: 0, z: 999, rotationX: 45, rotationY: 45, rotationZ: 0, mirrored: false },
      ],
    }
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [{ ...layer({ id: 'l1', componentId: 'comp-1' }), generator }],
      createdAt: '',
      updatedAt: '',
    }
    const geo = computeArrangementGeometry(arrangement, [comp])
    expect(geo.layers[0].outline).toHaveLength(2)
    expect(geo.bounds.maxX).toBeGreaterThan(500)
  })
})
