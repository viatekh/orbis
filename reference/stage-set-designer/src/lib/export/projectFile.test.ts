import { describe, expect, it, vi } from 'vitest'
import { importProject } from './projectFile'
import { loadJSONFile } from '../utils'

vi.mock('../utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils')>()
  return { ...actual, loadJSONFile: vi.fn() }
})

const legacyV1File = {
  schemaVersion: 1,
  id: 'proj-1',
  name: 'Old project',
  createdAt: '',
  updatedAt: '',
  components: [
    {
      id: 'comp-1',
      name: 'Component 1',
      shape: { kind: 'rect', width: 200, height: 200, cornerRadius: 0 },
      pattern: {
        kind: 'voronoi',
        mode: 'cut',
        cellSize: 20,
        jitter: 0.5,
        seed: 1,
        edgeMargin: 5,
        strutWidth: 3,
        minStrutWidth: 1,
        kerf: 0.1,
        cornerStyle: 'round',
        trimSlivers: true,
        sliverAreaRatio: 0.1,
        keepAllLevelsInCut: false,
        recursion: { depth: 1, childScale: 0.5, strutFalloff: 1, minCellArea: 10, maxLeafCells: 1000 },
        hexOrientation: 'pointy',
      },
      material: { thicknessMm: 6, label: 'Plywood' },
      createdAt: '',
      updatedAt: '',
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
          count: 6,
          radius: 100,
          startAngle: 0,
          arcSpan: 360,
          autoOrient: true,
          instanceRotation: 0,
          alternateMirror: false,
        },
      ],
    },
  ],
}

describe('importProject', () => {
  it('accepts a legacy schemaVersion 1 file and backfills it to a generator-shaped project', async () => {
    vi.mocked(loadJSONFile).mockResolvedValue(legacyV1File)
    const project = await importProject()
    expect(project.schemaVersion).toBe(2)
    expect(project.arrangements[0].layers[0].generator).toMatchObject({ kind: 'radial', count: 6, radius: 100 })
    expect(project.components[0].centerHole).toBeDefined()
  })

  it('accepts a current schemaVersion 2 file unchanged', async () => {
    const v2File = {
      ...legacyV1File,
      schemaVersion: 2,
      arrangements: [
        {
          ...legacyV1File.arrangements[0],
          layers: [
            {
              id: 'layer-1',
              name: 'Layer 1',
              componentId: 'comp-1',
              visible: true,
              generator: { kind: 'grid', rows: 2, cols: 2, spacingX: 100, spacingY: 100, staggerOffset: 0 },
              combineMode: 'none',
              depth: 0,
            },
          ],
        },
      ],
    }
    vi.mocked(loadJSONFile).mockResolvedValue(v2File)
    const project = await importProject()
    // rows/cols/spacing/stagger pass through unchanged; tiltDeg/swivelDeg get
    // backfilled to 0 since this fixture predates them (the v18 step).
    expect(project.arrangements[0].layers[0].generator).toEqual({
      kind: 'grid',
      rows: 2,
      cols: 2,
      spacingX: 100,
      spacingY: 100,
      staggerOffset: 0,
      tiltDeg: 0,
      swivelDeg: 0,
    })
  })

  it('rejects a file with an unrecognized schemaVersion', async () => {
    vi.mocked(loadJSONFile).mockResolvedValue({ ...legacyV1File, schemaVersion: 99 })
    await expect(importProject()).rejects.toThrow('Unrecognized project file format.')
  })

  it('rejects a file with no components array', async () => {
    vi.mocked(loadJSONFile).mockResolvedValue({ schemaVersion: 1 })
    await expect(importProject()).rejects.toThrow('Unrecognized project file format.')
  })
})
