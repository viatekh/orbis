import { describe, expect, it } from 'vitest'
import { backfillProject } from './backfillProject'

/** A v1-shaped project predating every backfilled field, including the
 * pre-v17 baked-in radial layer (count/radius/... directly on the layer,
 * no `generator`, `mergeOverlaps` instead of `combineMode`, no `depth`). */
function legacyProjectFixture() {
  return {
    schemaVersion: 1,
    id: 'proj-1',
    name: 'Legacy project',
    createdAt: '',
    updatedAt: '',
    components: [
      {
        id: 'comp-1',
        name: 'Component 1',
        shape: { kind: 'rect', width: 200, height: 200, cornerRadius: 0 },
        pattern: { kind: 'voronoi', mode: 'cut', cellSize: 20, jitter: 0.5, seed: 1, edgeMargin: 5, strutWidth: 3, minStrutWidth: 1, kerf: 0.1, cornerStyle: 'round', trimSlivers: true, sliverAreaRatio: 0.1, keepAllLevelsInCut: false, recursion: { depth: 1, childScale: 0.5, strutFalloff: 1, minCellArea: 10, maxLeafCells: 1000 }, hexOrientation: 'pointy' },
        material: { thicknessMm: 6, label: 'Plywood' },
        createdAt: '',
        updatedAt: '',
        // centerHole entirely absent — predates v10.
      },
    ],
    arrangements: [
      {
        id: 'arr-1',
        name: 'Arrangement 1',
        createdAt: '',
        updatedAt: '',
        layers: [
          {
            id: 'layer-1',
            name: 'Layer 1',
            componentId: 'comp-1',
            visible: true,
            count: 8,
            radius: 150,
            startAngle: 0,
            arcSpan: 360,
            autoOrient: true,
            instanceRotation: 0,
            alternateMirror: false,
            mergeOverlaps: true,
            // no combineMode, no depth, no generator — predates both.
          },
        ],
      },
    ],
  }
}

describe('backfillProject', () => {
  it('converts a legacy baked-radial layer into a radial generator with today defaults', () => {
    const result = backfillProject(legacyProjectFixture())
    const layer = result.arrangements[0].layers[0]
    expect(layer.generator).toEqual({
      kind: 'radial',
      count: 8,
      radius: 150,
      startAngle: 0,
      arcSpan: 360,
      autoOrient: true,
      instanceRotation: 0,
      alternateMirror: false,
      tiltDeg: 0,
      swivelDeg: 0,
      axis: 'z',
    })
  })

  it('backfills swivelDeg onto a v17 radial generator that predates it (v18 step)', () => {
    const fixture = legacyProjectFixture()
    const v17Generator = { kind: 'radial' as const, count: 3, radius: 50, startAngle: 0, arcSpan: 360, autoOrient: true, instanceRotation: 0, alternateMirror: false, tiltDeg: 20, axis: 'z' as const }
    fixture.arrangements[0].layers[0] = { ...fixture.arrangements[0].layers[0], generator: v17Generator } as never
    const result = backfillProject(fixture)
    expect(result.arrangements[0].layers[0].generator).toEqual({ ...v17Generator, swivelDeg: 0 })
  })

  it('backfills tiltDeg/swivelDeg onto a v17 grid generator that predates them (v18 step)', () => {
    const fixture = legacyProjectFixture()
    const v17Generator = { kind: 'grid' as const, rows: 2, cols: 2, spacingX: 100, spacingY: 100, staggerOffset: 0 }
    fixture.arrangements[0].layers[0] = { ...fixture.arrangements[0].layers[0], generator: v17Generator } as never
    const result = backfillProject(fixture)
    expect(result.arrangements[0].layers[0].generator).toEqual({ ...v17Generator, tiltDeg: 0, swivelDeg: 0 })
  })

  it('converts mergeOverlaps:true into combineMode "union", and backfills depth to 0', () => {
    const result = backfillProject(legacyProjectFixture())
    const layer = result.arrangements[0].layers[0]
    expect(layer.combineMode).toBe('union')
    expect(layer.depth).toBe(0)
  })

  it('leaves an already-generator-shaped layer untouched', () => {
    const fixture = legacyProjectFixture()
    const generator = { kind: 'radial' as const, count: 3, radius: 50, startAngle: 10, arcSpan: 180, autoOrient: false, instanceRotation: 5, alternateMirror: true, tiltDeg: 15, swivelDeg: -10, axis: 'x' as const }
    fixture.arrangements[0].layers[0] = { ...fixture.arrangements[0].layers[0], generator, combineMode: 'exclude', depth: 12 } as never
    const result = backfillProject(fixture)
    expect(result.arrangements[0].layers[0].generator).toEqual(generator)
    expect(result.arrangements[0].layers[0].combineMode).toBe('exclude')
    expect(result.arrangements[0].layers[0].depth).toBe(12)
  })

  it('backfills centerHole and all other nested pattern config for a component missing them', () => {
    const result = backfillProject(legacyProjectFixture())
    const comp = result.components[0]
    expect(comp.centerHole.enabled).toBe(false)
    expect(comp.pattern.radialModulation).toBeDefined()
    expect(comp.pattern.dispersion).toBeDefined()
    expect(comp.pattern.stamp).toBeDefined()
    expect(comp.pattern.symmetryCount).toBe(1)
    expect(comp.pattern.surfaceDetail).toBeDefined()
    expect(comp.pattern.edgeDetail).toBeDefined()
  })

  it('bumps schemaVersion to 2', () => {
    expect(backfillProject(legacyProjectFixture()).schemaVersion).toBe(2)
  })

  it('tolerates a project with no arrangements at all', () => {
    const fixture = legacyProjectFixture()
    // @ts-expect-error deliberately testing the missing-field case
    delete fixture.arrangements
    const result = backfillProject(fixture)
    expect(result.arrangements).toEqual([])
  })
})
