import { describe, expect, it } from 'vitest'
import { computeArrangementMesh } from './arrangementMesh'
import { computeComponentGeometry } from './pipeline'
import { buildComponentMesh } from '../export/stlExport'
import { DEFAULT_CENTER_HOLE_SHAPE, DEFAULT_EDGE_DETAIL, DEFAULT_PATTERN_CONFIG, DEFAULT_SHAPE } from './constants'
import type { Arrangement, ArrangementLayer, RadialGenerator, StageComponent } from '../../types'

function radialGenerator(overrides: Partial<RadialGenerator> = {}): RadialGenerator {
  return {
    kind: 'radial',
    count: 4,
    radius: 100,
    startAngle: 0,
    arcSpan: 360,
    autoOrient: false,
    instanceRotation: 0,
    alternateMirror: false,
    tiltDeg: 0,
    swivelDeg: 0,
    axis: 'z',
    ...overrides,
  }
}

function layer(overrides: Partial<Omit<ArrangementLayer, 'generator'>> & { generator?: RadialGenerator } = {}): ArrangementLayer {
  const { generator, ...rest } = overrides
  return {
    id: 'layer-1',
    name: 'Layer 1',
    componentId: 'comp-1',
    visible: true,
    generator: generator ?? radialGenerator(),
    combineMode: 'none',
    depth: 0,
    ...rest,
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

describe('computeArrangementMesh', () => {
  it('builds a non-empty mesh matching a direct buildComponentMesh call on the same component', () => {
    const comp = component('comp-1')
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [layer({ id: 'l1', componentId: 'comp-1' })],
      createdAt: '',
      updatedAt: '',
    }
    const result = computeArrangementMesh(arrangement, [comp])
    expect(result.layers).toHaveLength(1)
    expect(result.layers[0].mesh.length).toBeGreaterThan(0)

    const expected = buildComponentMesh(computeComponentGeometry(comp), comp.material.thicknessMm, 1.5)
    expect(result.layers[0].mesh.length).toBe(expected.length)
  })

  it('builds one mesh, reused across every instance of a radial layer', () => {
    const comp = component('comp-1')
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [layer({ id: 'l1', componentId: 'comp-1', generator: radialGenerator({ count: 6 }) })],
      createdAt: '',
      updatedAt: '',
    }
    const result = computeArrangementMesh(arrangement, [comp])
    expect(result.layers[0].instances).toHaveLength(6)
    // One mesh shared by all 6 instances, not six separate meshes.
    expect(result.layers[0].mesh.length).toBeGreaterThan(0)
  })

  it('skips an invisible layer, and a layer whose component no longer exists', () => {
    const comp = component('comp-1')
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [layer({ id: 'l1', componentId: 'comp-1', visible: false }), layer({ id: 'l2', componentId: 'missing' })],
      createdAt: '',
      updatedAt: '',
    }
    expect(() => computeArrangementMesh(arrangement, [comp])).not.toThrow()
    expect(computeArrangementMesh(arrangement, [comp]).layers).toHaveLength(0)
  })

  it('places a layer at its own depth, independent of the base', () => {
    const comp = component('comp-1')
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [
        layer({ id: 'l1', componentId: 'comp-1', generator: radialGenerator({ count: 1 }), depth: 0 }),
        layer({ id: 'l2', componentId: 'comp-1', generator: radialGenerator({ count: 1 }), depth: 50 }),
      ],
      createdAt: '',
      updatedAt: '',
    }
    const result = computeArrangementMesh(arrangement, [comp])
    expect(result.layers[0].instances[0].z).toBeCloseTo(0)
    expect(result.layers[1].instances[0].z).toBeCloseTo(50)
  })

  it("changing one layer's depth never moves another layer — regression for the cumulative-stack bug", () => {
    const comp = component('comp-1')
    const baseline: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [
        layer({ id: 'l1', componentId: 'comp-1', generator: radialGenerator({ count: 1 }), depth: 10 }),
        layer({ id: 'l2', componentId: 'comp-1', generator: radialGenerator({ count: 1 }), depth: 20 }),
      ],
      createdAt: '',
      updatedAt: '',
    }
    const zBefore = computeArrangementMesh(baseline, [comp]).layers[1].instances[0].z

    const editedFirstLayer: Arrangement = { ...baseline, layers: [{ ...baseline.layers[0], depth: 999 }, baseline.layers[1]] }
    const zAfter = computeArrangementMesh(editedFirstLayer, [comp]).layers[1].instances[0].z

    expect(zAfter).toBeCloseTo(zBefore)
  })

  it("an invisible layer's own depth has no effect on any other layer", () => {
    const comp = component('comp-1')
    const arrangement: Arrangement = {
      id: 'a1',
      name: 'A',
      layers: [
        layer({ id: 'l1', componentId: 'comp-1', visible: false, depth: 30 }),
        layer({ id: 'l2', componentId: 'comp-1', generator: radialGenerator({ count: 1 }), depth: 20 }),
      ],
      createdAt: '',
      updatedAt: '',
    }
    const result = computeArrangementMesh(arrangement, [comp])
    expect(result.layers).toHaveLength(1)
    expect(result.layers[0].instances[0].z).toBeCloseTo(20)
  })
})
