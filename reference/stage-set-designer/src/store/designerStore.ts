import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { debouncedLocalStorage } from '../lib/storage'
import { generateId } from '../lib/utils'
import { backfillProject } from '../lib/migration/backfillProject'
import { DEFAULT_CENTER_HOLE_SHAPE, DEFAULT_EDGE_DETAIL, DEFAULT_PATTERN_CONFIG, DEFAULT_SHAPE } from '../lib/geometry/constants'
import { scaleCenterHole, scalePatternForShape, scaleShapePrimitive, shapeScaleRatio } from '../lib/geometry/patternScale'
import { scaleGenerator } from '../lib/geometry/instanceTransform'
import type {
  Arrangement,
  ArrangementLayer,
  CenterHoleConfig,
  GridGenerator,
  ManualGenerator,
  PatternConfig,
  PlacementGenerator,
  Project,
  RadialGenerator,
  ShapePrimitive,
  StageComponent,
} from '../types'

function defaultCenterHole(): CenterHoleConfig {
  return {
    enabled: false,
    shape: { ...DEFAULT_CENTER_HOLE_SHAPE },
    offsetX: 0,
    offsetY: 0,
    margin: 0,
    edgeDetail: { ...DEFAULT_EDGE_DETAIL },
  }
}

function createComponent(name: string): StageComponent {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name,
    shape: { ...DEFAULT_SHAPE },
    pattern: structuredClone(DEFAULT_PATTERN_CONFIG),
    centerHole: defaultCenterHole(),
    material: { thicknessMm: 6, label: 'Plywood' },
    createdAt: now,
    updatedAt: now,
  }
}

function createArrangement(name: string): Arrangement {
  const now = new Date().toISOString()
  return { id: generateId(), name, layers: [], createdAt: now, updatedAt: now }
}

/** Builds a fresh generator of the given kind with sensible defaults — used
 * both for a brand new layer and when switching an existing layer's
 * generator kind. */
function defaultGeneratorFor(kind: PlacementGenerator['kind']): PlacementGenerator {
  switch (kind) {
    case 'radial':
      return {
        kind: 'radial',
        count: 6,
        radius: 200,
        startAngle: 0,
        arcSpan: 360,
        autoOrient: true,
        instanceRotation: 0,
        alternateMirror: false,
        tiltDeg: 0,
        swivelDeg: 0,
        axis: 'z',
      }
    case 'grid':
      return { kind: 'grid', rows: 4, cols: 4, spacingX: 100, spacingY: 100, staggerOffset: 0, tiltDeg: 0, swivelDeg: 0 }
    case 'manual':
      return { kind: 'manual', instances: [{ x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, mirrored: false }] }
  }
}

function createLayer(name: string, componentId: string): ArrangementLayer {
  return {
    id: generateId(),
    name,
    componentId,
    visible: true,
    generator: defaultGeneratorFor('radial'),
    combineMode: 'none',
    depth: 0,
  }
}

function createProject(): Project {
  const now = new Date().toISOString()
  return {
    schemaVersion: 2,
    id: generateId(),
    name: 'Untitled Project',
    components: [createComponent('Component 1')],
    arrangements: [],
    createdAt: now,
    updatedAt: now,
  }
}

type CanvasViewMode = '3d' | 'flat' | 'closeup'
/** Live-mirror latch for the freeform editor: while set, dragging any
 * anchor or handle updates its partner across the chosen axis in real
 * time, rather than the one-shot "Mirror" buttons' single snapshot. An
 * editor-session preference, not shape data — not persisted, matching
 * canvasViewMode. */
export type FreeformMirrorLock = 'off' | 'vertical' | 'horizontal'

interface DesignerState {
  project: Project
  activeComponentId: string
  activeArrangementId: string
  activeLayerId: string
  canvasViewMode: CanvasViewMode
  freeformMirrorLock: FreeformMirrorLock

  addComponent: () => void
  duplicateComponent: (id: string) => void
  removeComponent: (id: string) => void
  renameComponent: (id: string, name: string) => void
  setActiveComponent: (id: string) => void
  updateShape: (id: string, shape: ShapePrimitive) => void
  updatePattern: (id: string, pattern: Partial<PatternConfig>) => void
  updateCenterHole: (id: string, centerHole: Partial<CenterHoleConfig>) => void
  updateMaterial: (id: string, material: Partial<StageComponent['material']>) => void

  addArrangement: () => void
  duplicateArrangement: (id: string) => void
  removeArrangement: (id: string) => void
  renameArrangement: (id: string, name: string) => void
  setActiveArrangement: (id: string) => void

  addLayer: (arrangementId: string) => void
  removeLayer: (arrangementId: string, layerId: string) => void
  renameLayer: (arrangementId: string, layerId: string, name: string) => void
  updateLayer: (arrangementId: string, layerId: string, patch: Partial<ArrangementLayer>) => void
  updateGenerator: (
    arrangementId: string,
    layerId: string,
    patch: Partial<RadialGenerator> | Partial<GridGenerator> | Partial<ManualGenerator>,
  ) => void
  setLayerGeneratorKind: (arrangementId: string, layerId: string, kind: PlacementGenerator['kind']) => void
  /** Rescales every component this arrangement's layers reference (shape,
   * pattern, center hole, material thickness) and the arrangement's own
   * layers (depth, generator) by `factor` — the "calibrate scale by
   * picking two points" 3D-preview tool. No-op for a non-finite or
   * non-positive factor. Components are shared by id, so this also affects
   * any OTHER arrangement that happens to reuse the same component — same
   * as any other edit to a component today. */
  scaleArrangement: (arrangementId: string, factor: number) => void
  toggleLayerVisibility: (arrangementId: string, layerId: string) => void
  moveLayerForward: (arrangementId: string, layerId: string) => void
  moveLayerBackward: (arrangementId: string, layerId: string) => void
  /** Moves `layerId` to the position `targetLayerId` currently occupies in
   * the underlying (back-to-front) array, shifting the rest to make room —
   * used by drag-and-drop reordering, which lets a layer jump directly to
   * wherever it's dropped rather than one step at a time. */
  reorderLayer: (arrangementId: string, layerId: string, targetLayerId: string) => void
  setActiveLayer: (arrangementId: string, layerId: string) => void
  setCanvasViewMode: (mode: CanvasViewMode) => void
  setFreeformMirrorLock: (lock: FreeformMirrorLock) => void

  replaceProject: (project: Project) => void
  renameProject: (name: string) => void
}

function touchArrangement(arrangement: Arrangement): Arrangement {
  return { ...arrangement, updatedAt: new Date().toISOString() }
}

export const useDesignerStore = create<DesignerState>()(
  persist(
    (set) => ({
      project: createProject(),
      activeComponentId: '',
      activeArrangementId: '',
      activeLayerId: '',
      canvasViewMode: '3d',
      freeformMirrorLock: 'off',

      addComponent: () =>
        set((state) => {
          const c = createComponent(`Component ${state.project.components.length + 1}`)
          return {
            project: {
              ...state.project,
              components: [...state.project.components, c],
              updatedAt: new Date().toISOString(),
            },
            activeComponentId: c.id,
          }
        }),

      duplicateComponent: (id) =>
        set((state) => {
          const source = state.project.components.find((c) => c.id === id)
          if (!source) return state
          const now = new Date().toISOString()
          const copy: StageComponent = {
            ...structuredClone(source),
            id: generateId(),
            name: `${source.name} copy`,
            createdAt: now,
            updatedAt: now,
          }
          return {
            project: {
              ...state.project,
              components: [...state.project.components, copy],
              updatedAt: now,
            },
            activeComponentId: copy.id,
          }
        }),

      removeComponent: (id) =>
        set((state) => {
          const remaining = state.project.components.filter((c) => c.id !== id)
          const nextActive = state.activeComponentId === id ? (remaining[0]?.id ?? '') : state.activeComponentId
          return {
            project: { ...state.project, components: remaining, updatedAt: new Date().toISOString() },
            activeComponentId: nextActive,
          }
        }),

      renameComponent: (id, name) =>
        set((state) => ({
          project: {
            ...state.project,
            components: state.project.components.map((c) =>
              c.id === id ? { ...c, name, updatedAt: new Date().toISOString() } : c,
            ),
          },
        })),

      setActiveComponent: (id) => set({ activeComponentId: id }),

      updateShape: (id, shape) =>
        set((state) => ({
          project: {
            ...state.project,
            components: state.project.components.map((c) => {
              if (c.id !== id) return c
              // Rescale the pattern's absolute-mm parameters to match, so it
              // keeps looking proportionate after a resize, rather than
              // staying pinned to its old cell size/margins. Only for a
              // same-kind resize (a dimension slider or same-kind
              // randomize) — switching shape kind already resets to a fresh
              // default-sized shape, which isn't a "resize" of this one.
              const pattern =
                c.shape.kind === shape.kind
                  ? scalePatternForShape(c.pattern, shapeScaleRatio(c.shape, shape))
                  : c.pattern
              return { ...c, shape, pattern, updatedAt: new Date().toISOString() }
            }),
          },
        })),

      updatePattern: (id, pattern) =>
        set((state) => ({
          project: {
            ...state.project,
            components: state.project.components.map((c) =>
              c.id === id
                ? {
                    ...c,
                    pattern: {
                      ...c.pattern,
                      ...pattern,
                      recursion: { ...c.pattern.recursion, ...pattern.recursion },
                      radialModulation: { ...c.pattern.radialModulation, ...pattern.radialModulation },
                      stamp: { ...c.pattern.stamp, ...pattern.stamp },
                      surfaceDetail: pattern.surfaceDetail
                        ? {
                            ...c.pattern.surfaceDetail,
                            ...pattern.surfaceDetail,
                            pattern: {
                              ...c.pattern.surfaceDetail.pattern,
                              ...pattern.surfaceDetail.pattern,
                              recursion: {
                                ...c.pattern.surfaceDetail.pattern.recursion,
                                ...pattern.surfaceDetail.pattern?.recursion,
                              },
                              radialModulation: {
                                ...c.pattern.surfaceDetail.pattern.radialModulation,
                                ...pattern.surfaceDetail.pattern?.radialModulation,
                              },
                              stamp: {
                                ...c.pattern.surfaceDetail.pattern.stamp,
                                ...pattern.surfaceDetail.pattern?.stamp,
                              },
                            },
                          }
                        : c.pattern.surfaceDetail,
                    },
                    updatedAt: new Date().toISOString(),
                  }
                : c,
            ),
          },
        })),

      updateCenterHole: (id, centerHole) =>
        set((state) => ({
          project: {
            ...state.project,
            components: state.project.components.map((c) =>
              c.id === id
                ? { ...c, centerHole: { ...c.centerHole, ...centerHole }, updatedAt: new Date().toISOString() }
                : c,
            ),
          },
        })),

      updateMaterial: (id, material) =>
        set((state) => ({
          project: {
            ...state.project,
            components: state.project.components.map((c) =>
              c.id === id
                ? { ...c, material: { ...c.material, ...material }, updatedAt: new Date().toISOString() }
                : c,
            ),
          },
        })),

      addArrangement: () =>
        set((state) => {
          const a = createArrangement(`Arrangement ${state.project.arrangements.length + 1}`)
          return {
            project: {
              ...state.project,
              arrangements: [...state.project.arrangements, a],
              updatedAt: new Date().toISOString(),
            },
            activeArrangementId: a.id,
            activeLayerId: '',
          }
        }),

      duplicateArrangement: (id) =>
        set((state) => {
          const source = state.project.arrangements.find((a) => a.id === id)
          if (!source) return state
          const now = new Date().toISOString()
          const copy: Arrangement = {
            ...structuredClone(source),
            id: generateId(),
            name: `${source.name} copy`,
            layers: source.layers.map((l) => ({ ...l, id: generateId() })),
            createdAt: now,
            updatedAt: now,
          }
          return {
            project: {
              ...state.project,
              arrangements: [...state.project.arrangements, copy],
              updatedAt: now,
            },
            activeArrangementId: copy.id,
            activeLayerId: '',
          }
        }),

      removeArrangement: (id) =>
        set((state) => {
          const remaining = state.project.arrangements.filter((a) => a.id !== id)
          const nextActive = state.activeArrangementId === id ? (remaining[0]?.id ?? '') : state.activeArrangementId
          return {
            project: { ...state.project, arrangements: remaining, updatedAt: new Date().toISOString() },
            activeArrangementId: nextActive,
            activeLayerId: state.activeArrangementId === id ? '' : state.activeLayerId,
          }
        }),

      renameArrangement: (id, name) =>
        set((state) => ({
          project: {
            ...state.project,
            arrangements: state.project.arrangements.map((a) => (a.id === id ? { ...a, name } : a)),
          },
        })),

      setActiveArrangement: (id) => set({ activeArrangementId: id, activeLayerId: '' }),

      addLayer: (arrangementId) =>
        set((state) => {
          const firstComponent = state.project.components[0]
          if (!firstComponent) return state
          const arrangement = state.project.arrangements.find((a) => a.id === arrangementId)
          if (!arrangement) return state
          const layer = createLayer(`Layer ${arrangement.layers.length + 1}`, firstComponent.id)
          return {
            project: {
              ...state.project,
              arrangements: state.project.arrangements.map((a) =>
                a.id === arrangementId ? touchArrangement({ ...a, layers: [...a.layers, layer] }) : a,
              ),
              updatedAt: new Date().toISOString(),
            },
            activeArrangementId: arrangementId,
            activeLayerId: layer.id,
            activeComponentId: firstComponent.id,
          }
        }),

      removeLayer: (arrangementId, layerId) =>
        set((state) => ({
          project: {
            ...state.project,
            arrangements: state.project.arrangements.map((a) =>
              a.id === arrangementId
                ? touchArrangement({ ...a, layers: a.layers.filter((l) => l.id !== layerId) })
                : a,
            ),
          },
          activeLayerId: state.activeLayerId === layerId ? '' : state.activeLayerId,
        })),

      renameLayer: (arrangementId, layerId, name) =>
        set((state) => ({
          project: {
            ...state.project,
            arrangements: state.project.arrangements.map((a) =>
              a.id === arrangementId
                ? touchArrangement({ ...a, layers: a.layers.map((l) => (l.id === layerId ? { ...l, name } : l)) })
                : a,
            ),
          },
        })),

      updateLayer: (arrangementId, layerId, patch) =>
        set((state) => ({
          project: {
            ...state.project,
            arrangements: state.project.arrangements.map((a) =>
              a.id === arrangementId
                ? touchArrangement({ ...a, layers: a.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)) })
                : a,
            ),
          },
          activeComponentId:
            patch.componentId && state.activeLayerId === layerId ? patch.componentId : state.activeComponentId,
        })),

      updateGenerator: (arrangementId, layerId, patch) =>
        set((state) => ({
          project: {
            ...state.project,
            arrangements: state.project.arrangements.map((a) =>
              a.id === arrangementId
                ? touchArrangement({
                    ...a,
                    layers: a.layers.map((l) =>
                      l.id === layerId ? { ...l, generator: { ...l.generator, ...patch } as PlacementGenerator } : l,
                    ),
                  })
                : a,
            ),
          },
        })),

      setLayerGeneratorKind: (arrangementId, layerId, kind) =>
        set((state) => ({
          project: {
            ...state.project,
            arrangements: state.project.arrangements.map((a) =>
              a.id === arrangementId
                ? touchArrangement({
                    ...a,
                    // Reset combineMode to 'none' on a kind switch rather than
                    // carrying over whatever the previous generator had —
                    // union/subtract/intersect/exclude only make physical
                    // sense across coplanar instances, and silently keeping a
                    // non-'none' mode after switching to Manual (which can
                    // place instances anywhere in 3D) would produce a
                    // geometrically-wrong boolean with no visible warning.
                    layers: a.layers.map((l) =>
                      l.id === layerId ? { ...l, generator: defaultGeneratorFor(kind), combineMode: 'none' } : l,
                    ),
                  })
                : a,
            ),
          },
        })),

      scaleArrangement: (arrangementId, factor) =>
        set((state) => {
          if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return state
          const arrangement = state.project.arrangements.find((a) => a.id === arrangementId)
          if (!arrangement) return state
          const componentIds = new Set(arrangement.layers.map((l) => l.componentId))
          const now = new Date().toISOString()
          return {
            project: {
              ...state.project,
              components: state.project.components.map((c) =>
                componentIds.has(c.id)
                  ? {
                      ...c,
                      shape: scaleShapePrimitive(c.shape, factor),
                      pattern: scalePatternForShape(c.pattern, factor),
                      centerHole: scaleCenterHole(c.centerHole, factor),
                      material: { ...c.material, thicknessMm: c.material.thicknessMm * factor },
                      updatedAt: now,
                    }
                  : c,
              ),
              arrangements: state.project.arrangements.map((a) =>
                a.id === arrangementId
                  ? touchArrangement({
                      ...a,
                      layers: a.layers.map((l) => ({ ...l, depth: l.depth * factor, generator: scaleGenerator(l.generator, factor) })),
                    })
                  : a,
              ),
            },
          }
        }),

      toggleLayerVisibility: (arrangementId, layerId) =>
        set((state) => ({
          project: {
            ...state.project,
            arrangements: state.project.arrangements.map((a) =>
              a.id === arrangementId
                ? touchArrangement({
                    ...a,
                    layers: a.layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l)),
                  })
                : a,
            ),
          },
        })),

      moveLayerForward: (arrangementId, layerId) =>
        set((state) => ({
          project: {
            ...state.project,
            arrangements: state.project.arrangements.map((a) => {
              if (a.id !== arrangementId) return a
              const idx = a.layers.findIndex((l) => l.id === layerId)
              if (idx === -1 || idx === a.layers.length - 1) return a
              const layers = [...a.layers]
              ;[layers[idx], layers[idx + 1]] = [layers[idx + 1], layers[idx]]
              return touchArrangement({ ...a, layers })
            }),
          },
        })),

      moveLayerBackward: (arrangementId, layerId) =>
        set((state) => ({
          project: {
            ...state.project,
            arrangements: state.project.arrangements.map((a) => {
              if (a.id !== arrangementId) return a
              const idx = a.layers.findIndex((l) => l.id === layerId)
              if (idx <= 0) return a
              const layers = [...a.layers]
              ;[layers[idx - 1], layers[idx]] = [layers[idx], layers[idx - 1]]
              return touchArrangement({ ...a, layers })
            }),
          },
        })),

      reorderLayer: (arrangementId, layerId, targetLayerId) =>
        set((state) => ({
          project: {
            ...state.project,
            arrangements: state.project.arrangements.map((a) => {
              if (a.id !== arrangementId || layerId === targetLayerId) return a
              const fromIndex = a.layers.findIndex((l) => l.id === layerId)
              const toIndex = a.layers.findIndex((l) => l.id === targetLayerId)
              if (fromIndex === -1 || toIndex === -1) return a
              const layers = [...a.layers]
              const [moved] = layers.splice(fromIndex, 1)
              layers.splice(toIndex, 0, moved)
              return touchArrangement({ ...a, layers })
            }),
          },
        })),

      setActiveLayer: (arrangementId, layerId) =>
        set((state) => {
          const arrangement = state.project.arrangements.find((a) => a.id === arrangementId)
          const layer = arrangement?.layers.find((l) => l.id === layerId)
          return {
            activeArrangementId: arrangementId,
            activeLayerId: layerId,
            activeComponentId: layer ? layer.componentId : state.activeComponentId,
          }
        }),

      setCanvasViewMode: (mode) => set({ canvasViewMode: mode }),
      setFreeformMirrorLock: (lock) => set({ freeformMirrorLock: lock }),

      replaceProject: (project) =>
        set(() => {
          // Run the same backfill the persist `migrate` hook below runs for
          // localStorage projects — without this, a project file imported
          // via ExportPanel's "Import project JSON" skipped every round of
          // field backfill and could crash downstream on `undefined` fields
          // that any localStorage project had long since been migrated past.
          const backfilled = backfillProject(project)
          return {
            project: backfilled,
            activeComponentId: backfilled.components[0]?.id ?? '',
            activeArrangementId: backfilled.arrangements[0]?.id ?? '',
            activeLayerId: '',
          }
        }),

      renameProject: (name) =>
        set((state) => ({
          project: { ...state.project, name, updatedAt: new Date().toISOString() },
        })),
    }),
    {
      name: 'stage-set-designer-project',
      storage: createJSONStorage(() => debouncedLocalStorage),
      partialize: (state) => ({
        project: state.project,
        activeComponentId: state.activeComponentId,
        activeArrangementId: state.activeArrangementId,
        activeLayerId: state.activeLayerId,
      }),
      // v17: layers' baked-in radial fields replaced by `generator`
      // (radial/grid/manual) — see lib/migration/backfillProject.ts, which
      // now holds the full backfill chain (v3 onward) previously inlined
      // here. Extracted so file import (projectFile.ts) can run the exact
      // same backfill localStorage projects already got — previously it
      // ran none of it.
      // v18: backfill swivelDeg (a second, independent tilt axis) on a
      // radial generator, and tiltDeg/swivelDeg on a grid generator — both
      // 0 keeps every existing layer exactly as flat/untilted as it already
      // rendered before these fields existed.
      version: 18,
      migrate: (persisted) => {
        const state = persisted as { project?: Project }
        return {
          ...state,
          project: state.project ? backfillProject(state.project) : state.project,
          activeArrangementId: '',
          activeLayerId: '',
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (!state.activeComponentId && state.project.components[0]) {
          state.activeComponentId = state.project.components[0].id
        }
        if (!state.activeArrangementId && state.project.arrangements[0]) {
          state.activeArrangementId = state.project.arrangements[0].id
        }
      },
    },
  ),
)
