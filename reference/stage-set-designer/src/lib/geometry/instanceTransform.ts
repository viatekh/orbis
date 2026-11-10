import type { GridGenerator, Instance3D, ManualGenerator, PlacementGenerator, Polygon, RadialGenerator } from './types'

export interface InstanceTransform {
  x: number
  y: number
  rotationDeg: number
  mirrored: boolean
}

/** The subset of ArrangementLayer's fields this needs — kept local (rather
 * than importing the app-level ArrangementLayer type) so this pure geometry
 * module has no dependency on app/domain code. Any object with these fields
 * (an ArrangementLayer, or a synthetic ring config from the stamp pattern
 * generator) works. */
export interface RadialPlacement {
  count: number
  radius: number
  startAngle: number
  arcSpan: number
  autoOrient: boolean
  instanceRotation: number
  alternateMirror: boolean
}

/** Placement angle 0 = +X axis, same convention used by shape rotation
 * fields elsewhere (regularPolygon, star). A full circle divides by `count`
 * so no instance duplicates the seam; a partial arc divides by `count - 1`
 * so both ends of the arc are populated. */
export function computeInstanceTransforms(layer: RadialPlacement): InstanceTransform[] {
  const n = Math.max(1, Math.round(layer.count))
  const span = Math.min(360, Math.max(1, layer.arcSpan))
  const isFullCircle = span >= 360
  const angleStep = isFullCircle ? span / n : n > 1 ? span / (n - 1) : 0

  const transforms: InstanceTransform[] = []
  for (let i = 0; i < n; i++) {
    const angleDeg = layer.startAngle + i * angleStep
    const angleRad = (angleDeg * Math.PI) / 180
    const rotationDeg = (layer.autoOrient ? angleDeg : 0) + layer.instanceRotation
    transforms.push({
      x: layer.radius * Math.cos(angleRad),
      y: layer.radius * Math.sin(angleRad),
      rotationDeg,
      mirrored: layer.alternateMirror && i % 2 === 1,
    })
  }
  return transforms
}

export function transformPolygon(poly: Polygon, t: InstanceTransform): Polygon {
  const rad = (t.rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return poly.map((p) => {
    const px = t.mirrored ? -p.x : p.x
    return { x: px * cos - p.y * sin + t.x, y: px * sin + p.y * cos + t.y }
  })
}

export function transformPolygons(polys: Polygon[], t: InstanceTransform): Polygon[] {
  return polys.map((p) => transformPolygon(p, t))
}

/** Maps a ring's local (radius·cos, radius·sin) position into whichever
 * plane `axis` selects: 'z' keeps it flat/top-down (today's only behavior),
 * 'x'/'y' stand the ring up vertical instead — a totem/crown ring rather
 * than a flat wheel. */
function placeOnRingAxis(axis: RadialGenerator['axis'], localX: number, localY: number): { x: number; y: number; z: number } {
  switch (axis) {
    case 'z':
      return { x: localX, y: localY, z: 0 }
    case 'x':
      return { x: 0, y: localX, z: localY }
    case 'y':
      return { x: localX, y: 0, z: localY }
  }
}

/** 3D-capable successor to `computeInstanceTransforms` — same radial-array
 * math (count/radius/startAngle/arcSpan/autoOrient/instanceRotation/
 * alternateMirror), extended with `axis` (which plane the ring lies in) and
 * `tiltDeg`/`swivelDeg` (stored verbatim as each instance's rotationX/
 * rotationY — a uniform two-axis cant). Kept as a separate function rather
 * than replacing `computeInstanceTransforms` because patterns/stamp.ts
 * reuses that one for its own flat, single-component ring-stamping, which
 * has no use for a 3D placement. */
export function computeRadialTransforms(gen: RadialGenerator): Instance3D[] {
  const n = Math.max(1, Math.round(gen.count))
  const span = Math.min(360, Math.max(1, gen.arcSpan))
  const isFullCircle = span >= 360
  const angleStep = isFullCircle ? span / n : n > 1 ? span / (n - 1) : 0

  const transforms: Instance3D[] = []
  for (let i = 0; i < n; i++) {
    const angleDeg = gen.startAngle + i * angleStep
    const angleRad = (angleDeg * Math.PI) / 180
    const localX = gen.radius * Math.cos(angleRad)
    const localY = gen.radius * Math.sin(angleRad)
    transforms.push({
      ...placeOnRingAxis(gen.axis, localX, localY),
      rotationZ: (gen.autoOrient ? angleDeg : 0) + gen.instanceRotation,
      rotationX: gen.tiltDeg,
      rotationY: gen.swivelDeg,
      mirrored: gen.alternateMirror && i % 2 === 1,
    })
  }
  return transforms
}

/** A flat rows×cols tiling, alternating rows shifted by `staggerOffset`
 * along X for a brick/honeycomb-style offset. `tiltDeg`/`swivelDeg` cant
 * every tile the same amount (stored verbatim as rotationX/rotationY) — a
 * per-tile-varying curvature (a true faceted dome) is a Manual-generator
 * job until a dedicated 3D-aware tiling need arises. */
export function computeGridTransforms(gen: GridGenerator): Instance3D[] {
  const rows = Math.max(1, Math.round(gen.rows))
  const cols = Math.max(1, Math.round(gen.cols))
  const transforms: Instance3D[] = []
  for (let row = 0; row < rows; row++) {
    const rowOffset = row % 2 === 1 ? gen.staggerOffset : 0
    for (let col = 0; col < cols; col++) {
      transforms.push({
        x: col * gen.spacingX + rowOffset,
        y: row * gen.spacingY,
        z: 0,
        rotationX: gen.tiltDeg,
        rotationY: gen.swivelDeg,
        rotationZ: 0,
        mirrored: false,
      })
    }
  }
  return transforms
}

/** No formula — the authored instance list, verbatim. */
export function computeManualTransforms(gen: ManualGenerator): Instance3D[] {
  return gen.instances
}

export function computePlacementTransforms(gen: PlacementGenerator): Instance3D[] {
  switch (gen.kind) {
    case 'radial':
      return computeRadialTransforms(gen)
    case 'grid':
      return computeGridTransforms(gen)
    case 'manual':
      return computeManualTransforms(gen)
  }
}

/** Scales a generator's real-world-length fields by `k` — the same "only
 * lengths, not angles/counts/flags" rule scaleShapePrimitive/
 * scalePatternForShape (patternScale.ts) already follow, applied to
 * placement instead of shape/pattern. Radial's `radius` scales; `count`,
 * `startAngle`, `arcSpan`, `tiltDeg`, `swivelDeg`, `axis` don't. Grid's
 * `spacingX`/`spacingY`/`staggerOffset` scale; `rows`/`cols`/`tiltDeg`/
 * `swivelDeg` don't. Manual scales each instance's `x`/`y`/`z`; rotation
 * fields and `mirrored` don't. */
export function scaleGenerator(gen: PlacementGenerator, k: number): PlacementGenerator {
  if (k === 1) return gen
  switch (gen.kind) {
    case 'radial':
      return { ...gen, radius: gen.radius * k }
    case 'grid':
      return { ...gen, spacingX: gen.spacingX * k, spacingY: gen.spacingY * k, staggerOffset: gen.staggerOffset * k }
    case 'manual':
      return { ...gen, instances: gen.instances.map((i) => ({ ...i, x: i.x * k, y: i.y * k, z: i.z * k })) }
  }
}

/** Projects a 3D instance placement down to the flat 2D transform the cut-
 * geometry pipeline actually consumes (see `Instance3D`'s doc comment for
 * why: each component's own pattern is a flat sheet, so only x/y/
 * rotationZ/mirrored ever affect its cut outline). */
export function projectToPlane(instance: Instance3D): InstanceTransform {
  return { x: instance.x, y: instance.y, rotationDeg: instance.rotationZ, mirrored: instance.mirrored }
}
