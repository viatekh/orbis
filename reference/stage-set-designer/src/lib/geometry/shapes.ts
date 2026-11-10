import { roundCorners, unionPolys } from './clipper'
import { minEdgeLength, bounds, area } from './polygon'
import { mulberry32, hash32 } from './random'
import { CURVE_SEGMENTS } from './constants'
import { buildRibbonFromCenterline } from './ribbon'
import type { FreeformPoint, Point, Polygon, ShapePrimitive } from './types'

function buildRectRaw(shape: Extract<ShapePrimitive, { kind: 'rect' }>): Polygon {
  const { width, height } = shape
  const w = width / 2
  const h = height / 2
  return [
    { x: -w, y: -h },
    { x: w, y: -h },
    { x: w, y: h },
    { x: -w, y: h },
  ]
}

function buildRegularPolygonRaw(shape: Extract<ShapePrimitive, { kind: 'regularPolygon' }>): Polygon {
  const { sides, radius, rotation } = shape
  const n = Math.max(3, Math.round(sides))
  const rot = (rotation * Math.PI) / 180
  const points: Point[] = []
  for (let i = 0; i < n; i++) {
    const angle = rot + (i * 2 * Math.PI) / n
    points.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) })
  }
  return points
}

function buildStarRaw(shape: Extract<ShapePrimitive, { kind: 'star' }>): Polygon {
  const { points, radius, innerRadiusRatio, rotation } = shape
  const n = Math.max(3, Math.round(points))
  const rot = (rotation * Math.PI) / 180
  const inner = radius * innerRadiusRatio
  const verts: Point[] = []
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? radius : inner
    const angle = rot + (i * Math.PI) / n
    verts.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) })
  }
  return verts
}

function signedPow(v: number, exponent: number): number {
  return Math.sign(v) * Math.abs(v) ** exponent
}

/** Tessellated superellipse (|x/a|^n + |y/b|^n = 1) — a continuous curve
 * between a diamond (n≈1), ellipse (n=2), and rounded rect / "squircle"
 * (n≈4+), approaching a sharp rectangle as n grows. */
function buildSuperellipseRaw(shape: Extract<ShapePrimitive, { kind: 'superellipse' }>): Polygon {
  const { width, height, exponent } = shape
  const n = Math.max(0.3, exponent)
  const a = width / 2
  const b = height / 2
  const p = 2 / n
  const points: Point[] = []
  for (let i = 0; i < CURVE_SEGMENTS; i++) {
    const t = (i / CURVE_SEGMENTS) * Math.PI * 2
    points.push({ x: a * signedPow(Math.cos(t), p), y: b * signedPow(Math.sin(t), p) })
  }
  return points
}

/** Seeded organic outline: a circle perturbed by a handful of low-order
 * cosine harmonics with randomized amplitude/phase, so the same seed always
 * reproduces the same blob (mirrors the pattern engine's seed/jitter UX). */
function buildBlobRaw(shape: Extract<ShapePrimitive, { kind: 'blob' }>): Polygon {
  const { radius, complexity, irregularity, seed } = shape
  const maxHarmonic = Math.max(2, Math.round(complexity))
  const rng = mulberry32(hash32(seed))
  const harmonics: { k: number; amp: number; phase: number }[] = []
  for (let k = 2; k <= maxHarmonic; k++) {
    harmonics.push({ k, amp: rng(), phase: rng() * Math.PI * 2 })
  }
  const totalAmp = harmonics.reduce((sum, h) => sum + h.amp, 0) || 1
  const clampedIrregularity = Math.min(0.95, Math.max(0, irregularity))

  const points: Point[] = []
  for (let i = 0; i < CURVE_SEGMENTS; i++) {
    const theta = (i / CURVE_SEGMENTS) * Math.PI * 2
    let r = radius
    for (const h of harmonics) {
      r += radius * clampedIrregularity * (h.amp / totalAmp) * Math.cos(h.k * theta + h.phase)
    }
    points.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) })
  }
  return points
}

/** Built geometrically rather than as a polar r(θ) plot: a round bulb
 * (circle of radius R) with two straight tangent lines converging to a
 * sharp point at distance `d` from the bulb's center. This is the standard
 * construction for a true teardrop/raindrop silhouette — width increases
 * monotonically from the point to the bulb, with no dip or cleft near the
 * tip (the old r(θ)=radius·|sin(θ/2)|^p formula swept angle faster than
 * radius grew near θ=0, producing two flanking lobes either side of the
 * point instead of a clean taper). `pointSharpness` sets the ratio d/R —
 * higher means a longer, narrower tail and a sharper point. */
function buildTeardropRaw(shape: Extract<ShapePrimitive, { kind: 'teardrop' }>): Polygon {
  const { radius, pointSharpness, rotation } = shape
  const rot = (rotation * Math.PI) / 180
  const R = radius * 0.45
  const d = R * (1 + Math.max(0.05, pointSharpness))
  const phi = Math.asin(Math.min(0.999, R / d))
  const arcSegs = Math.max(8, Math.round((CURVE_SEGMENTS * (Math.PI + 2 * phi)) / (Math.PI * 2)))

  const raw: Point[] = [{ x: 0, y: 0 }]
  const startAngle = -phi
  const endAngle = Math.PI + phi
  for (let i = 0; i <= arcSegs; i++) {
    const psi = startAngle + ((endAngle - startAngle) * i) / arcSegs
    raw.push({ x: R * Math.cos(psi), y: d + R * Math.sin(psi) })
  }

  // Center on the shape's own bounding box (tip-to-bulb span), matching how
  // other point-based shapes in this file sit around the origin.
  const b = bounds(raw)
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  return raw.map((p) => {
    const x = p.x - cx
    const y = p.y - cy
    return { x: x * cos - y * sin, y: x * sin + y * cos }
  })
}

function buildDiamondRaw(shape: Extract<ShapePrimitive, { kind: 'diamond' }>): Polygon {
  const { width, height } = shape
  const w = width / 2
  const h = height / 2
  return [
    { x: 0, y: -h },
    { x: w, y: 0 },
    { x: 0, y: h },
    { x: -w, y: 0 },
  ]
}

/** A symmetric lens/vesica shape (almond/marquise) built from two circular
 * arcs meeting at sharp corners on the shape's own X axis. `phi` (the arcs'
 * half-angle) and their radius `R` are solved in closed form from `w`
 * (half the corner-to-corner width) and `h` (the apex height) via the
 * half-angle identity tan(φ/2) = h/w. */
function buildEyeRaw(shape: Extract<ShapePrimitive, { kind: 'eye' }>): Polygon {
  const { width, rotation } = shape
  const w = width / 2
  const h = Math.max(0.5, shape.height / 2)
  const phi = 2 * Math.atan2(h, w)
  const R = w / Math.sin(phi)
  const rot = (rotation * Math.PI) / 180
  const segs = Math.max(2, Math.round(CURVE_SEGMENTS / 2))

  const raw: Point[] = []
  for (let i = 0; i <= segs; i++) {
    const theta = -phi + (2 * phi * i) / segs
    raw.push({ x: R * Math.sin(theta), y: h - R + R * Math.cos(theta) })
  }
  for (let i = 1; i <= segs; i++) {
    const theta = phi - (2 * phi * i) / segs
    raw.push({ x: R * Math.sin(theta), y: -(h - R + R * Math.cos(theta)) })
  }

  if (rotation === 0) return raw
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  return raw.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }))
}

/** Archimedean-ish spiral centerline (radius interpolates linearly with
 * angle from startRadius to endRadius) stroked into a ribbon. The ribbon's
 * half-width is clamped to the local radius at every point — the only way
 * a ribbon can validly approach the center without its two edges crossing
 * past it — which is what gives a small `startRadius` its natural taper to
 * a point with no separate flag. */
function buildSpiralRaw(shape: Extract<ShapePrimitive, { kind: 'spiral' }>): Polygon {
  const { turns, startRadius, endRadius, strokeWidth, rotation } = shape
  const rot = (rotation * Math.PI) / 180
  const totalAngle = turns * 2 * Math.PI
  const segments = Math.max(16, Math.round(CURVE_SEGMENTS * Math.max(1, turns)))
  const halfWidth = strokeWidth / 2

  const centerline: Point[] = []
  const radii: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const r = startRadius + (endRadius - startRadius) * t
    const angle = rot + totalAngle * t
    centerline.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) })
    radii.push(r)
  }
  return buildRibbonFromCenterline(centerline, (i) => Math.min(halfWidth, radii[i]))
}

/** A sinusoidal centerline stroked into a ribbon whose width is modulated
 * at twice the wave frequency (peaking at each crest/trough, pinched at
 * the zero-crossings between them) and tapered to a point over the first
 * and last 5% of its length — width bulges at natural "leaf node"
 * positions along a smoothly tapered vine. */
function buildVineRaw(shape: Extract<ShapePrimitive, { kind: 'vine' }>): Polygon {
  const { length, amplitude, waveCount, strokeWidth, leafBulge, rotation } = shape
  const rot = (rotation * Math.PI) / 180
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const segments = Math.max(16, CURVE_SEGMENTS)
  const halfLen = length / 2
  const halfWidth = strokeWidth / 2

  const centerline: Point[] = []
  const widths: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const localX = -halfLen + length * t
    const localY = amplitude * Math.sin(2 * Math.PI * waveCount * t)
    centerline.push({ x: localX * cos - localY * sin, y: localX * sin + localY * cos })

    const bulge = 1 + leafBulge * Math.sin(2 * Math.PI * waveCount * t) ** 2
    const endTaper = Math.max(0, Math.min(1, t / 0.05, (1 - t) / 0.05))
    widths.push(halfWidth * bulge * endTaper)
  }
  return buildRibbonFromCenterline(centerline, (i) => widths[i])
}

/** A spine-and-width-profile leaf silhouette: a (possibly bent) centerline
 * from base to tip, stroked into a ribbon whose half-width rises from 0 at
 * the base to `maxWidth`/2 at `widthPosition` then falls back to 0 at the
 * tip — the same "stroke a centerline" trick as spiral/vine, just with a
 * single-peak width profile instead of a periodic one. `baseTaper`/`tipTaper`
 * (as an exponent on the normalized distance either side of the peak) let
 * each side round off gently or draw to a sharp point independently. */
function buildLeafRaw(shape: Extract<ShapePrimitive, { kind: 'leaf' }>): Polygon {
  const { length, maxWidth, widthPosition, baseTaper, tipTaper, curvature, rotation } = shape
  const rot = (rotation * Math.PI) / 180
  const segments = Math.max(16, CURVE_SEGMENTS)
  const halfWidth = maxWidth / 2
  const wp = Math.min(0.95, Math.max(0.05, widthPosition))
  const bendRad = (curvature * Math.PI) / 180

  const centerline: Point[] = []
  const widths: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    if (Math.abs(bendRad) < 1e-6) {
      centerline.push({ x: t * length, y: 0 })
    } else {
      const radius = length / bendRad
      const theta = bendRad * t
      centerline.push({ x: radius * Math.sin(theta), y: radius * (1 - Math.cos(theta)) })
    }

    const side = t <= wp ? t / wp : (1 - t) / (1 - wp)
    const taper = t <= wp ? baseTaper : tipTaper
    widths.push(halfWidth * side ** taper)
  }

  const ribbon = buildRibbonFromCenterline(centerline, (i) => widths[i])
  const b = bounds(ribbon)
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const centered = ribbon.map((p) => ({ x: p.x - cx, y: p.y - cy }))

  if (rotation === 0) return centered
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  return centered.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }))
}

function cubicBezierPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
}

/** Cubic bezier through a closed loop of anchor points, each carrying its
 * own "pull handle" as an (hx, hy) offset. The OUTGOING control point at
 * anchor i is `anchor + handle`; the INCOMING control point (the tangent
 * a segment arrives at its end anchor with) is `anchor - handle` — the
 * handle mirrored through its own anchor, the standard "smooth point"
 * convention, so the curve never kinks at an anchor whose handle hasn't
 * been touched. `segmentsPerSpan` points are interpolated per edge. */
function bezierFreeformClosed(points: FreeformPoint[], segmentsPerSpan: number): Polygon {
  const n = points.length
  if (n < 3) return points.map((p) => ({ x: p.x, y: p.y }))
  const result: Point[] = []
  for (let i = 0; i < n; i++) {
    const p0 = points[i]
    const p3 = points[(i + 1) % n]
    const p1: Point = { x: p0.x + p0.hx, y: p0.y + p0.hy }
    const p2: Point = { x: p3.x - p3.hx, y: p3.y - p3.hy }
    for (let s = 0; s < segmentsPerSpan; s++) {
      result.push(cubicBezierPoint(p0, p1, p2, p3, s / segmentsPerSpan))
    }
  }
  return result
}

/** A single tapered barb: a thin triangle from a root point on the spine
 * edge, swept forward by `sweepRad` from straight-out, tapering to a
 * point at `barbLength`. */
function buildBarb(root: Point, outwardDir: Point, forwardDir: Point, barbLength: number, barbWidth: number, sweepRad: number): Polygon {
  const dir: Point = {
    x: outwardDir.x * Math.cos(sweepRad) + forwardDir.x * Math.sin(sweepRad),
    y: outwardDir.y * Math.cos(sweepRad) + forwardDir.y * Math.sin(sweepRad),
  }
  const tip: Point = { x: root.x + dir.x * barbLength, y: root.y + dir.y * barbLength }
  const half = barbWidth / 2
  const base1: Point = { x: root.x + forwardDir.x * half, y: root.y + forwardDir.y * half }
  const base2: Point = { x: root.x - forwardDir.x * half, y: root.y - forwardDir.y * half }
  return [base1, tip, base2]
}

function buildFeatherRaw(shape: Extract<ShapePrimitive, { kind: 'feather' }>): Polygon {
  const { length, spineWidth, barbCount, barbLength, barbWidth, barbSweep, rotation } = shape
  const rot = (rotation * Math.PI) / 180
  const n = Math.max(1, Math.round(barbCount))
  const sweepRad = (barbSweep * Math.PI) / 180
  const forward: Point = { x: 1, y: 0 }
  const outwardUp: Point = { x: 0, y: -1 }
  const outwardDown: Point = { x: 0, y: 1 }

  const spineCenterline: Point[] = Array.from({ length: CURVE_SEGMENTS }, (_, i) => ({
    x: (length * i) / (CURVE_SEGMENTS - 1),
    y: 0,
  }))
  const spineHalf = spineWidth / 2
  const spine = buildRibbonFromCenterline(spineCenterline, (i) => {
    const t = i / (CURVE_SEGMENTS - 1)
    return spineHalf * (1 - t * 0.7) ** 0.6
  })

  const pieces: Polygon[] = [spine]
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n
    const root: Point = { x: length * t, y: 0 }
    const lengthAt = barbLength * (1 - t * 0.5)
    const widthAt = barbWidth * (1 - t * 0.3)
    pieces.push(buildBarb(root, outwardUp, forward, lengthAt, widthAt, sweepRad))
    pieces.push(buildBarb(root, outwardDown, forward, lengthAt, widthAt, sweepRad))
  }

  const unioned = unionPolys(pieces)
  const raw = unioned.length === 0 ? spine : unioned.reduce((biggest, p) => (area(p) > area(biggest) ? p : biggest))

  const b = bounds(raw)
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const centered = raw.map((p) => ({ x: p.x - cx, y: p.y - cy }))

  if (rotation === 0) return centered
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  return centered.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }))
}

function buildFreeformRaw(shape: Extract<ShapePrimitive, { kind: 'freeform' }>): Polygon {
  const { points } = shape
  if (points.length < 3) return points.map((p) => ({ x: p.x, y: p.y }))
  return bezierFreeformClosed(points, Math.max(4, Math.round(CURVE_SEGMENTS / points.length)))
}

function clampCornerRadius(raw: Polygon, requested: number): number {
  if (requested <= 0) return 0
  return Math.min(requested, 0.45 * minEdgeLength(raw))
}

function withCornerRounding(raw: Polygon, requested: number): Polygon {
  const radius = clampCornerRadius(raw, requested)
  return radius > 0 ? roundCorners(raw, radius) : raw
}

export function buildShapeOutline(shape: ShapePrimitive): Polygon {
  switch (shape.kind) {
    case 'rect':
      return withCornerRounding(buildRectRaw(shape), shape.cornerRadius)
    case 'regularPolygon':
      return withCornerRounding(buildRegularPolygonRaw(shape), shape.cornerRadius)
    case 'star':
      return withCornerRounding(buildStarRaw(shape), shape.cornerRadius)
    case 'superellipse':
      return buildSuperellipseRaw(shape)
    case 'blob':
      return buildBlobRaw(shape)
    case 'teardrop':
      return buildTeardropRaw(shape)
    case 'diamond':
      return withCornerRounding(buildDiamondRaw(shape), shape.cornerRadius)
    case 'eye':
      return buildEyeRaw(shape)
    case 'spiral':
      return buildSpiralRaw(shape)
    case 'vine':
      return buildVineRaw(shape)
    case 'leaf':
      return buildLeafRaw(shape)
    case 'freeform':
      return buildFreeformRaw(shape)
    case 'feather':
      return buildFeatherRaw(shape)
  }
}
