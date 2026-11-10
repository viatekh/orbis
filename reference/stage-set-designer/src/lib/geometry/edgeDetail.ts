import { differencePolys, inset, outset, unionPolys } from './clipper'
import { sampleBoundary, type BoundarySample } from './boundarySample'
import type { EdgeDetailConfig, Point, Polygon } from './types'

function circlePoly(center: Point, radius: number, segments = 16): Polygon {
  const pts: Point[] = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) })
  }
  return pts
}

function buildDots(samples: BoundarySample[], sign: number, offset: number, size: number): Polygon[] {
  const r = size / 2
  return samples.map(({ point, inward }) => {
    const cx = point.x + inward.x * sign * (offset + r)
    const cy = point.y + inward.y * sign * (offset + r)
    return circlePoly({ x: cx, y: cy }, r)
  })
}

function buildTicks(samples: BoundarySample[], sign: number, offset: number, size: number): Polygon[] {
  const halfW = Math.max(0.2, size * 0.15)
  return samples.map(({ point, inward }) => {
    const nx = inward.x * sign
    const ny = inward.y * sign
    const tx = -ny
    const ty = nx
    const p0: Point = { x: point.x + nx * offset, y: point.y + ny * offset }
    const p1: Point = { x: point.x + nx * (offset + size), y: point.y + ny * (offset + size) }
    return [
      { x: p0.x + tx * halfW, y: p0.y + ty * halfW },
      { x: p1.x + tx * halfW, y: p1.y + ty * halfW },
      { x: p1.x - tx * halfW, y: p1.y - ty * halfW },
      { x: p0.x - tx * halfW, y: p0.y - ty * halfW },
    ]
  })
}

function buildDashes(samples: BoundarySample[], sign: number, offset: number, size: number): Polygon[] {
  const n = samples.length
  const halfLen = size / 2
  const halfW = Math.max(0.2, size * 0.25)
  return samples.map(({ point, inward }, i) => {
    const nx = inward.x * sign
    const ny = inward.y * sign
    const next = samples[(i + 1) % n].point
    const prev = samples[(i - 1 + n) % n].point
    let tx = next.x - prev.x
    let ty = next.y - prev.y
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl
    ty /= tl
    const cx = point.x + nx * (offset + halfW)
    const cy = point.y + ny * (offset + halfW)
    const a: Point = { x: cx - tx * halfLen, y: cy - ty * halfLen }
    const b: Point = { x: cx + tx * halfLen, y: cy + ty * halfLen }
    return [
      { x: a.x + nx * halfW, y: a.y + ny * halfW },
      { x: b.x + nx * halfW, y: b.y + ny * halfW },
      { x: b.x - nx * halfW, y: b.y - ny * halfW },
      { x: a.x - nx * halfW, y: a.y - ny * halfW },
    ]
  })
}

/** A single continuous band hugging the boundary, whose inner edge
 * undulates — a sine bump for 'wave', a triangle wave for 'zigzag'.
 *
 * The band's OUTER edge is built with Clipper's own polygon offsetting
 * (`inset`/`outset`) rather than by hand — a boundary with sharp corners
 * (a plain rectangle, say) needs a proper miter/round join there, which a
 * naive per-sample offset doesn't give it. The WAVY inner edge still has
 * to be built per-sample (the depth varies along it), but rather than
 * hand-stitching it to the outer ring as one polygon with an implicit
 * seam — fragile exactly at those same sharp corners, where it produced
 * severe self-intersections that Clipper's fill rule then misread as
 * large solid regions instead of a thin band — the two are combined with
 * a real `differencePolys` boolean op, which handles corner artifacts
 * correctly on either side independently. */
function buildBand(samples: BoundarySample[], boundary: Polygon, sign: number, offset: number, size: number, spacing: number, kind: 'wave' | 'zigzag'): Polygon[] {
  const minThickness = Math.max(0.2, size * 0.2)
  const amplitude = size * 0.8
  const inner: Point[] = []
  for (const { point, inward, s } of samples) {
    const nx = inward.x * sign
    const ny = inward.y * sign
    const phase = (s / spacing) * Math.PI * 2
    let mod: number
    if (kind === 'wave') {
      mod = (amplitude / 2) * (1 - Math.cos(phase))
    } else {
      const u = ((s / spacing) % 1 + 1) % 1
      mod = amplitude * (u < 0.5 ? u * 2 : (1 - u) * 2)
    }
    const depth = offset + minThickness + mod
    inner.push({ x: point.x + nx * depth, y: point.y + ny * depth })
  }

  const outerOffset = sign === 1 ? inset(boundary, offset, 'round') : outset(boundary, offset, 'round')
  if (!outerOffset[0] || outerOffset[0].length < 3) return []
  // `inner` is passed to differencePolys AS IS, self-intersections and
  // all — Clipper's NonZero-fill boolean engine already resolves a
  // self-intersecting clip polygon correctly via winding numbers. Running
  // it through a self-union "cleanup" pass first was tried and made things
  // worse: it splits the ring into several same-signed disjoint pieces
  // that lose the winding relationship the difference op needs, so it
  // stopped actually subtracting — verified by comparing both against the
  // expected thin-band area on a rectangle (sharp corners are exactly
  // where this showed up).
  return differencePolys(outerOffset, [inner])
}

/** Builds the decorative edge-detail geometry for one boundary. `sign`
 * controls which side of the boundary the motif extends into: pass 1 to
 * decorate into the polygon's own interior (the outer-edge case — the
 * interior IS the solid panel), or -1 to decorate away from it (the
 * portal-hole case — the hole's interior is the void, so the motif needs
 * to extend outward into the surrounding solid material instead). */
export function buildEdgeDetailPolys(boundary: Polygon, config: EdgeDetailConfig, sign: 1 | -1): Polygon[] {
  if (!config.enabled) return []
  const spacing = Math.max(1, config.spacing)
  const size = Math.max(0.2, config.size)
  const offset = Math.max(0, config.offset)

  if (config.kind === 'wave' || config.kind === 'zigzag') {
    const fineSpacing = Math.min(spacing / 12, 3)
    const samples = sampleBoundary(boundary, fineSpacing)
    if (samples.length === 0) return []
    return buildBand(samples, boundary, sign, offset, size, spacing, config.kind)
  }

  const samples = sampleBoundary(boundary, spacing)
  if (samples.length === 0) return []
  let motifs: Polygon[]
  if (config.kind === 'dots') motifs = buildDots(samples, sign, offset, size)
  else if (config.kind === 'ticks') motifs = buildTicks(samples, sign, offset, size)
  else motifs = buildDashes(samples, sign, offset, size)
  return unionPolys(motifs)
}
