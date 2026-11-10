import {
  DEFAULT_CENTER_HOLE_SHAPE,
  DEFAULT_DISPERSION,
  DEFAULT_EDGE_DETAIL,
  DEFAULT_RADIAL_MODULATION,
  DEFAULT_STAMP_CONFIG,
  DEFAULT_SURFACE_DETAIL_PATTERN,
} from '../geometry/constants'
import type { Arrangement, ArrangementLayer, BooleanMode, CenterHoleConfig, PlacementGenerator, Project, ShapePrimitive, StageComponent } from '../../types'

/** The shape a persisted ArrangementLayer could be in before v17 replaced
 * its baked-in radial fields with `generator` — kept local to this
 * migration step, not merged into the real ArrangementLayer type. */
interface LegacyRadialLayer {
  generator?: PlacementGenerator
  count?: number
  radius?: number
  startAngle?: number
  arcSpan?: number
  autoOrient?: boolean
  instanceRotation?: number
  alternateMirror?: boolean
  mergeOverlaps?: boolean
  combineMode?: BooleanMode
  depth?: number
}

/** Backfills every field added to the persisted project shape since it was
 * first introduced. Versionless and idempotent by design — every step uses
 * `??`, so already-migrated data passes through unchanged — which is what
 * makes it safe to run unconditionally on a project from ANY source: the
 * zustand `persist` migrate hook (existing localStorage projects) and file
 * import (projectFile.ts) alike. Extracted from designerStore's persist
 * `migrate` because, before this, only the localStorage path ran it — an
 * imported project file skipped all of it and could crash on `undefined`
 * fields that localStorage projects had long since been backfilled past. */
export function backfillProject(input: unknown): Project {
  const project = input as Project & { arrangements?: Arrangement[] }
  const arrangements = project.arrangements ?? []

  // v3: backfill fields added by radial modulation / stamp patterns /
  // overlap merge — older saved projects predate these and would crash
  // (e.g. `pattern.radialModulation.enabled`) without this.
  // v4: backfill symmetryCount (rotational symmetry).
  // v6: backfill nullShape / explodeAmount (null-shape pieces).
  // v7: backfill surfaceDetail (independent etch-only detail layer).
  // v8: backfill mirrorSymmetry (dihedral/kaleidoscope symmetry) on both the
  // main pattern and, since surfaceDetail may already have been backfilled
  // by a prior v7 run, its nested pattern too.
  // v9: backfill mirrorAxisAngle (the axis a STANDALONE mirror — no
  // rotational copies — reflects across), same both-places logic.
  // v10: backfill centerHole (Portal-style opening), off by default.
  // v11: backfill hx/hy (pull-handle offsets) on freeform shape points — the
  // kind predates handles, storing plain {x,y}, which would otherwise
  // compute as NaN once the curve builder starts reading point.hx/point.hy.
  // Auto-tangent from neighbors, same formula shapeDefaults.ts's autoHandle
  // uses, so an upgraded shape looks exactly as smooth as it did before.
  // v12: backfill centerHole.margin (clearance ring around the Portal
  // opening) — 0 keeps prior behavior (lattice cut flush against the hole
  // edge) unchanged for existing saved projects.
  // v13: backfill edgeDetail (decorative motif banded around an edge) on
  // both the main pattern (outer edge) and centerHole (hole rim) — off by
  // default, same both-places pattern as mirrorSymmetry/mirrorAxisAngle
  // above.
  // v14: mirrorAxisAngle (single-axis, any angle in principle but the UI
  // only ever set 0 or 90) replaced by two independent booleans,
  // mirrorHorizontal/mirrorVertical, so both can be on at once for 4-fold/
  // quadrant symmetry. A saved angle of 90 becomes vertical-only; anything
  // else (including absent, for pre-v9 data) becomes horizontal-only,
  // matching the old default.
  const migrateMirrorAxis = (p: {
    mirrorAxisAngle?: number
    mirrorHorizontal?: boolean
    mirrorVertical?: boolean
  }): { mirrorHorizontal: boolean; mirrorVertical: boolean } => {
    if (typeof p.mirrorHorizontal === 'boolean' || typeof p.mirrorVertical === 'boolean') {
      return { mirrorHorizontal: p.mirrorHorizontal ?? true, mirrorVertical: p.mirrorVertical ?? false }
    }
    return p.mirrorAxisAngle === 90
      ? { mirrorHorizontal: false, mirrorVertical: true }
      : { mirrorHorizontal: true, mirrorVertical: false }
  }
  const backfillFreeformHandles = (shape: ShapePrimitive): ShapePrimitive => {
    if (shape.kind !== 'freeform') return shape
    const positions = shape.points.map((p) => ({ x: p.x, y: p.y }))
    const n = positions.length
    return {
      kind: 'freeform',
      points: shape.points.map((p, i) => {
        if (typeof p.hx === 'number' && typeof p.hy === 'number') return p
        if (n < 3) return { x: p.x, y: p.y, hx: 0, hy: 0 }
        const prev = positions[(i - 1 + n) % n]
        const next = positions[(i + 1) % n]
        return { x: p.x, y: p.y, hx: (next.x - prev.x) / 6, hy: (next.y - prev.y) / 6 }
      }),
    }
  }
  const components: StageComponent[] = (project.components ?? []).map((c) => {
    const surfaceDetail = c.pattern.surfaceDetail ?? { enabled: false, pattern: { ...DEFAULT_SURFACE_DETAIL_PATTERN } }
    const centerHole =
      c.centerHole ?? ({ enabled: false, shape: { ...DEFAULT_CENTER_HOLE_SHAPE }, offsetX: 0, offsetY: 0, margin: 0 } as CenterHoleConfig)
    return {
      ...c,
      shape: backfillFreeformHandles(c.shape),
      centerHole: {
        ...centerHole,
        margin: centerHole.margin ?? 0,
        edgeDetail: centerHole.edgeDetail ?? { ...DEFAULT_EDGE_DETAIL },
        shape: backfillFreeformHandles(centerHole.shape),
      },
      pattern: {
        ...c.pattern,
        radialModulation: c.pattern.radialModulation ?? { ...DEFAULT_RADIAL_MODULATION },
        dispersion: c.pattern.dispersion ?? { ...DEFAULT_DISPERSION },
        stamp: c.pattern.stamp ?? { ...DEFAULT_STAMP_CONFIG },
        symmetryCount: c.pattern.symmetryCount ?? 1,
        mirrorSymmetry: c.pattern.mirrorSymmetry ?? false,
        ...migrateMirrorAxis(c.pattern),
        nullShape: c.pattern.nullShape ?? false,
        explodeAmount: c.pattern.explodeAmount ?? 0,
        edgeDetail: c.pattern.edgeDetail ?? { ...DEFAULT_EDGE_DETAIL },
        surfaceDetail: {
          ...surfaceDetail,
          pattern: {
            ...surfaceDetail.pattern,
            mirrorSymmetry: surfaceDetail.pattern.mirrorSymmetry ?? false,
            ...migrateMirrorAxis(surfaceDetail.pattern),
            dispersion: surfaceDetail.pattern.dispersion ?? { ...DEFAULT_DISPERSION },
          },
        },
      },
    }
  })

  // v5: mergeOverlaps (boolean) replaced by combineMode (the full Union/
  // Subtract/Intersect/Exclude toolkit) — true becomes 'union' (its closest
  // equivalent), everything else becomes 'none'.
  // v15: backfill depth (Z-offset from the previous layer, for assembly
  // fins) — 0 keeps every existing layer flush/coplanar, exactly as it
  // already rendered before this field existed.
  // v16: backfill dispersion (random per-cell size/distance variation,
  // independent of cellSize/jitter) on both the main pattern and
  // surfaceDetail's nested pattern — off by default. (Handled above, in the
  // component loop, since it applies per-pattern regardless of version.)
  // v17: a layer's baked-in radial fields (count/radius/startAngle/arcSpan/
  // autoOrient/instanceRotation/alternateMirror) replaced by `generator`, so
  // a layer can be radial, grid, or manually-placed instead of always
  // radial. An old layer's fields become a `generator: {kind:'radial',...}`
  // with the new tiltDeg/axis fields defaulted to today's only prior
  // behavior (flat, no cant).
  // v18: backfill swivelDeg (a second, independent tilt axis) on a radial
  // generator, and tiltDeg/swivelDeg on a grid generator — 0 keeps every
  // existing layer exactly as flat/untilted as it already rendered before
  // these fields existed. Applies whether the generator is freshly built
  // from pre-v17 legacy fields (below) or already generator-shaped from a
  // v17 save that predates v18's fields.
  const backfillGenerator = (l: ArrangementLayer & LegacyRadialLayer): PlacementGenerator => {
    const generator: PlacementGenerator = l.generator ?? {
      kind: 'radial',
      count: l.count ?? 6,
      radius: l.radius ?? 200,
      startAngle: l.startAngle ?? 0,
      arcSpan: l.arcSpan ?? 360,
      autoOrient: l.autoOrient ?? true,
      instanceRotation: l.instanceRotation ?? 0,
      alternateMirror: l.alternateMirror ?? false,
      tiltDeg: 0,
      swivelDeg: 0,
      axis: 'z',
    }
    if (generator.kind === 'radial') return { ...generator, tiltDeg: generator.tiltDeg ?? 0, swivelDeg: generator.swivelDeg ?? 0 }
    if (generator.kind === 'grid') return { ...generator, tiltDeg: generator.tiltDeg ?? 0, swivelDeg: generator.swivelDeg ?? 0 }
    return generator
  }
  const newArrangements: Arrangement[] = arrangements.map((a) => ({
    ...a,
    layers: a.layers.map((l) => {
      const legacy = l as ArrangementLayer & LegacyRadialLayer
      return {
        id: l.id,
        name: l.name,
        componentId: l.componentId,
        visible: l.visible,
        generator: backfillGenerator(legacy),
        combineMode: legacy.combineMode ?? (legacy.mergeOverlaps ? 'union' : 'none'),
        depth: legacy.depth ?? 0,
      }
    }),
  }))

  return { ...project, schemaVersion: 2, components, arrangements: newArrangements }
}
