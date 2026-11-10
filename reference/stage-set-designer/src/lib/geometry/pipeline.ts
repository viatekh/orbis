import { differencePolys, inset, intersectPolys, outset, simplify, unionPolys } from './clipper'
import { area, boundsOfPolygons, bounds, centroid, maxDistanceFrom, mirrorPolygon, rotatePolygon, translatePolygon } from './polygon'
import { buildPatternTree, collectAll, collectLeaves, createRunState } from './recursion'
import { validateFabrication } from './validate'
import { buildShapeOutline } from './shapes'
import { buildEdgeDetailPolys } from './edgeDetail'
import { DEFAULT_EDGE_DETAIL } from './constants'
import { CURVE_SEGMENTS } from './constants'
import type { GeometryResult, PatternConfig, Point, Polygon } from './types'
import type { CenterHoleConfig, StageComponent } from '../../types'

function intersectEachAgainstOutline(polys: Polygon[], outline: Polygon): Polygon[] {
  return polys.flatMap((p) => intersectPolys([p], [outline]))
}

/** A pie-slice polygon from `center`, spanning [0, wedgeAngleDeg], out to
 * `radius` — used to clip pattern generation down to a single repeat unit
 * for true rotational symmetry. */
function buildWedgePolygon(center: Point, radius: number, wedgeAngleDeg: number): Polygon {
  const segments = Math.max(2, Math.round((CURVE_SEGMENTS * wedgeAngleDeg) / 360))
  const points: Point[] = [center]
  for (let i = 0; i <= segments; i++) {
    const angle = (wedgeAngleDeg * i) / segments
    const rad = (angle * Math.PI) / 180
    points.push({ x: center.x + radius * Math.cos(rad), y: center.y + radius * Math.sin(rad) })
  }
  return points
}

/** Rotate-copies a wedge's cells around `center`, `count` times, to fill
 * the full circle. Each copy's own radial-modulation rotation (orient-to-
 * center, swirl) stays correct automatically — rotating an already-outward-
 * facing cell by the wedge step keeps it facing outward at its new angle.
 *
 * When `mirror` is on, `polys` is expected to have been generated in only
 * a HALF wedge (0 to angleStep/2 — see the halved wedge angle passed to
 * `buildWedgePolygon` at the call site). Each of the `count` rotational
 * positions then gets BOTH the original half-wedge content and its
 * reflection across the half-wedge's own far edge, together completing one
 * bilaterally-symmetric full wedge (0 to angleStep) before the next
 * rotation starts — a true dihedral (kaleidoscope) pattern rather than
 * just `count` spinning copies of the same asymmetric motif. */
function repeatAroundSymmetry(polys: Polygon[], center: Point, count: number, mirror: boolean): Polygon[] {
  if (count <= 1) return polys
  const angleStep = 360 / count
  const result: Polygon[] = []
  for (let i = 0; i < count; i++) {
    const angleDeg = angleStep * i
    for (const p of polys) result.push(rotatePolygon(p, center, angleDeg))
    if (mirror) {
      const halfAngle = angleStep / 2
      for (const p of polys) result.push(rotatePolygon(mirrorPolygon(p, center, halfAngle), center, angleDeg))
    }
  }
  return result
}

/** A large rectangle covering one whole side of the line through `center`
 * at `axisAngleDeg` — the generation region for STANDALONE mirror symmetry
 * (symmetryCount === 1: mirrorSymmetry with no rotational copies at all).
 * Unlike `buildWedgePolygon`'s pie-slice — correct for rotational repeats,
 * all measured by angle from a shared center — a plain reflection needs a
 * half-PLANE split by a straight line, which isn't the same shape. */
function buildHalfPlanePolygon(center: Point, radius: number, axisAngleDeg: number): Polygon {
  const rad = (axisAngleDeg * Math.PI) / 180
  const dir: Point = { x: Math.cos(rad), y: Math.sin(rad) }
  const n: Point = { x: -dir.y, y: dir.x }
  const a: Point = { x: center.x - dir.x * radius, y: center.y - dir.y * radius }
  const b: Point = { x: center.x + dir.x * radius, y: center.y + dir.y * radius }
  const c: Point = { x: b.x + n.x * radius, y: b.y + n.y * radius }
  const d: Point = { x: a.x + n.x * radius, y: a.y + n.y * radius }
  return [a, b, c, d]
}

/** Mirrors `polys` once across the line through `center` at `axisAngleDeg`,
 * keeping both the generated half and its reflection — the "mirror
 * symmetry without rotational copies" case. */
function mirrorOnceAcrossAxis(polys: Polygon[], center: Point, axisAngleDeg: number): Polygon[] {
  return [...polys, ...polys.map((p) => mirrorPolygon(p, center, axisAngleDeg))]
}

/** The translation a piece gets pushed by `amount` mm away from `center`,
 * on top of whatever gap the strut inset already gives it. A piece exactly
 * on the center keeps a stable direction of (1,0) since there's nothing to
 * push it away from. Exposed as just the offset (rather than an
 * apply-and-return-the-piece helper) so the same displacement can also be
 * applied to a detail-pattern fragment that belongs to this piece, keeping
 * the two in registration as the piece explodes outward. */
function explodeOffset(piece: Polygon, center: Point, amount: number): Point {
  if (amount === 0) return { x: 0, y: 0 }
  const c = centroid(piece)
  const dx = c.x - center.x
  const dy = c.y - center.y
  const dist = Math.hypot(dx, dy)
  const dir: Point = dist > 1e-9 ? { x: dx / dist, y: dy / dist } : { x: 1, y: 0 }
  return { x: dir.x * amount, y: dir.y * amount }
}

const EMPTY_BOUNDS_RESULT = (outline: Polygon): GeometryResult => ({
  outline: [outline],
  patternBoundary: [],
  cutPaths: [],
  etchPaths: [],
  detailEtchPaths: [],
  bounds: bounds(outline),
  stats: {
    leafCells: 0,
    totalCells: 0,
    maxLevelReached: 0,
    minStrutUsed: 0,
    cutAreaMm2: 0,
    materialAreaMm2: area(outline),
    computeMs: 0,
    truncated: false,
  },
  warnings: [{ code: 'no-cells-generated', message: 'Edge margin leaves no room for a pattern.' }],
})

/** Pure. No DOM, no store, no React — safe to move to a Worker verbatim.
 * Both the live canvas and the SVG exporter render from this same result,
 * so on-screen preview and export can never diverge. */
export function computePatternGeometry(outline: Polygon, config: PatternConfig): GeometryResult {
  const t0 = performance.now()
  const outlineArea = area(outline)

  const marginInsetResults = inset(outline, config.edgeMargin, config.cornerStyle)
  const patternBoundary = marginInsetResults[0]

  if (!patternBoundary || patternBoundary.length < 3) {
    return EMPTY_BOUNDS_RESULT(outline)
  }

  // Raw-cell generation clips every candidate cell against this boundary —
  // for a smooth/organic outline (dozens+ of vertices, often non-convex)
  // that cost dominates runtime. Simplifying it here is safe because the
  // final result is still intersected against the true, unsimplified
  // `outline` below, so no cell can ever end up outside the real shape.
  const clippingBoundary = simplify(patternBoundary, Math.max(0.05, config.cellSize * 0.05))

  // Fixed reference frame for radial effects (size gradient, orient-to-
  // center, swirl, stamp rings) — the whole shape's center, computed once
  // from the OUTER outline so it stays stable across every recursion level.
  const patternCenter = centroid(outline)
  const patternMaxRadius = maxDistanceFrom(patternCenter, outline)

  const symmetryCount = Math.max(1, Math.round(config.symmetryCount))
  const rotationalMirror = config.mirrorSymmetry && symmetryCount > 1
  // Mirror with NO rotational copies at all — one or two bilateral
  // reflections (horizontal, vertical, or both for 4-fold/quadrant
  // symmetry) independent of symmetryCount.
  const standaloneMirror = config.mirrorSymmetry && symmetryCount === 1
  const mirrorH = standaloneMirror && config.mirrorHorizontal
  const mirrorV = standaloneMirror && config.mirrorVertical
  // Dihedral symmetry generates only a HALF wedge — the other half is a
  // mirror reflection of it, built in `repeatAroundSymmetry` below — so
  // each final repeat unit (a full wedge) ends up twice as dense as a
  // plain rotational repeat unit would need to generate on its own.
  const wedgeAngle = 360 / symmetryCount / (rotationalMirror ? 2 : 1)
  let generationBoundary = clippingBoundary
  if (symmetryCount > 1) {
    // Generate only one wedge (or half-wedge, for mirror symmetry), then
    // rotate/mirror-copy it — guarantees an exact repeat regardless of cell
    // size/jitter, rather than an approximate one from density alone.
    const wedge = buildWedgePolygon(patternCenter, patternMaxRadius * 1.05, wedgeAngle)
    const wedgeClipped = intersectPolys([clippingBoundary], [wedge])[0]
    if (wedgeClipped && wedgeClipped.length >= 3) generationBoundary = wedgeClipped
  } else if (mirrorH || mirrorV) {
    // Same idea, one (or two) dimensions down: generate only one quadrant/
    // half, then reflect it back out — an exact repeat rather than an
    // approximate symmetric-looking field. Intersecting both half-planes
    // in turn when both axes are active restricts generation to a single
    // quadrant before the two reflections below rebuild the other three.
    if (mirrorH) {
      const half = buildHalfPlanePolygon(patternCenter, patternMaxRadius * 2.2, 0)
      const clipped = intersectPolys([generationBoundary], [half])[0]
      if (clipped && clipped.length >= 3) generationBoundary = clipped
    }
    if (mirrorV) {
      const half = buildHalfPlanePolygon(patternCenter, patternMaxRadius * 2.2, 90)
      const clipped = intersectPolys([generationBoundary], [half])[0]
      if (clipped && clipped.length >= 3) generationBoundary = clipped
    }
  }

  // The budget caps the FINAL cell count, so the per-generation-unit share
  // accounts for every final repeat — symmetryCount rotations, doubled for
  // dihedral mirroring, or doubled per active standalone axis (so 4x when
  // both horizontal and vertical are on).
  const standaloneMirrorMultiplier = mirrorH && mirrorV ? 4 : mirrorH || mirrorV ? 2 : 1
  const repeatMultiplier = symmetryCount * (rotationalMirror ? 2 : standaloneMirrorMultiplier)
  const state = createRunState(Math.max(1, Math.ceil(config.recursion.maxLeafCells / repeatMultiplier)))
  const tree = buildPatternTree(
    generationBoundary,
    config,
    state,
    0,
    0,
    config.cellSize,
    config.strutWidth,
    patternCenter,
    patternMaxRadius,
  )

  const applySymmetry = (polys: Polygon[]): Polygon[] => {
    if (symmetryCount > 1) return repeatAroundSymmetry(polys, patternCenter, symmetryCount, rotationalMirror)
    let result = polys
    if (mirrorH) result = mirrorOnceAcrossAxis(result, patternCenter, 0)
    if (mirrorV) result = mirrorOnceAcrossAxis(result, patternCenter, 90)
    return result
  }

  const leaves = applySymmetry(collectLeaves(tree))

  // Surface detail: a second, independent pattern across the same outline,
  // always etch-only. Computed once, up front, so both branches below can
  // use it. Guarded by `enabled: false` on the nested call so this can
  // never recurse more than one level deep — a detail layer can't itself
  // carry another nested detail layer (see SurfaceDetailPatternConfig).
  let detailEtchRaw: Polygon[] = []
  let detailWarnings: GeometryResult['warnings'] = []
  if (config.surfaceDetail.enabled) {
    const detailConfig: PatternConfig = {
      ...config.surfaceDetail.pattern,
      mode: 'etch',
      nullShape: false,
      explodeAmount: 0,
      keepAllLevelsInCut: false,
      surfaceDetail: { enabled: false, pattern: config.surfaceDetail.pattern },
      edgeDetail: { ...DEFAULT_EDGE_DETAIL },
    }
    const detail = computePatternGeometry(outline, detailConfig)
    detailEtchRaw = detail.etchPaths
    detailWarnings = detail.warnings
  }

  if (config.nullShape) {
    // The designed shape stops being a boundary or a border to cut — it
    // was only ever a container deciding which cells exist. The exported
    // outline becomes the union of the leaf cells themselves (an organic
    // silhouette that hugs the pattern), optionally pushed apart further.
    // No safety-net clip against the true outline here: exploded pieces
    // are meant to be free to extend past where the container used to be.
    //
    // Surface detail is registered per piece: whatever fine trace fell
    // within a given leaf's ORIGINAL (pre-explode) footprint is clipped to
    // that footprint, then carried along by the exact same offset as the
    // piece — so the decoration travels with its piece as Explode amount
    // pushes it outward, rather than staying pinned to the old grid.
    const exploded: Polygon[] = []
    const explodedDetail: Polygon[] = []
    for (const leaf of leaves) {
      const offset = explodeOffset(leaf, patternCenter, config.explodeAmount)
      exploded.push(translatePolygon(leaf, offset.x, offset.y))
      if (detailEtchRaw.length > 0) {
        const ownDetail = intersectPolys(detailEtchRaw, [leaf])
        for (const d of ownDetail) explodedDetail.push(translatePolygon(d, offset.x, offset.y))
      }
    }
    const pieces = unionPolys(exploded)
    const materialAreaMm2 = pieces.reduce((sum, p) => sum + area(p), 0)
    const warnings = [...validateFabrication(config, state.truncated, pieces.length), ...detailWarnings]
    return {
      outline: pieces,
      patternBoundary,
      cutPaths: [],
      etchPaths: [],
      detailEtchPaths: explodedDetail,
      bounds: boundsOfPolygons(pieces),
      stats: {
        leafCells: pieces.length,
        totalCells: state.totalCells,
        maxLevelReached: state.maxLevelReached,
        minStrutUsed: config.strutWidth,
        cutAreaMm2: 0,
        materialAreaMm2,
        computeMs: performance.now() - t0,
        truncated: state.truncated,
      },
      warnings,
    }
  }

  const allLevels = applySymmetry(collectAll(tree))

  let cutPaths: Polygon[] = []
  let etchPaths: Polygon[] = []
  let detailEtchPaths: Polygon[]

  if (config.mode === 'cut') {
    if (config.keepAllLevelsInCut) {
      // allLevels contains nested parent/child polygons by design — batching
      // them into one Clipper subject set would fill-merge nested shapes
      // into their outer envelope, so each is clipped independently.
      cutPaths = intersectEachAgainstOutline(allLevels, outline)
    } else {
      // Leaves never overlap each other, so batching them in one Clipper
      // call is both safe and cheaper.
      cutPaths = intersectPolys(leaves, [outline])
    }
    // The main lattice's cut cells are actual removed material — a detail
    // fragment computed independently across the whole outline has no idea
    // those holes exist, so anything that landed inside one gets trimmed
    // back to whatever solid material (strut) survives around it.
    detailEtchPaths = differencePolys(detailEtchRaw, cutPaths)
  } else {
    etchPaths = intersectEachAgainstOutline(allLevels, outline)
    detailEtchPaths = detailEtchRaw
  }

  // Edge detail: a decorative motif banded around the outer edge,
  // independent of the main lattice — cut-mode motifs become extra
  // through-holes (unioned into cutPaths), etch-mode motifs become extra
  // decoration (unioned into detailEtchPaths, alongside the surface-detail
  // layer). Clipped to the true outline so a motif can never poke outside
  // the panel's own edge.
  if (config.edgeDetail.enabled) {
    const motifs = intersectEachAgainstOutline(buildEdgeDetailPolys(outline, config.edgeDetail, 1), outline)
    if (config.edgeDetail.mode === 'cut') {
      cutPaths = unionPolys([...cutPaths, ...motifs])
    } else {
      detailEtchPaths = unionPolys([...detailEtchPaths, ...motifs])
    }
  }

  const leafCount = config.mode === 'cut' ? cutPaths.length : etchPaths.length
  const warnings = [...validateFabrication(config, state.truncated, leafCount), ...detailWarnings]

  const cutAreaMm2 = cutPaths.reduce((sum, p) => sum + area(p), 0)

  return {
    outline: [outline],
    patternBoundary,
    cutPaths,
    etchPaths,
    detailEtchPaths,
    bounds: bounds(outline),
    stats: {
      leafCells: leaves.length,
      totalCells: state.totalCells,
      maxLevelReached: state.maxLevelReached,
      minStrutUsed: config.strutWidth,
      cutAreaMm2,
      materialAreaMm2: outlineArea - cutAreaMm2,
      computeMs: performance.now() - t0,
      truncated: state.truncated,
    },
    warnings,
  }
}

/** A Portal-style center opening, applied as a post-process rather than
 * threaded through pattern generation: the hole is subtracted from every
 * already-computed cut/etch region (so the lattice naturally stops at its
 * edge — a cell that overlapped it becomes a partial cell terminating
 * right at the boundary, exactly the "frame around an opening" look) and
 * added as an extra contour in `outline` (so it renders — and exports —
 * as a genuine through-hole in the material, in both cut and etch mode).
 * Skipped for null-shape output: there's no panel there to punch a hole
 * in, only the cells themselves.
 *
 * `hole.margin` expands ONLY the region cut/etch/detail geometry is kept
 * clear of — a solid collar around the opening — while the opening itself
 * (the contour added to `outline`) always stays at the hole's own raw
 * size, so the margin never shrinks the actual through-hole. */
function applyCenterHole(result: GeometryResult, outline: Polygon, hole: CenterHoleConfig, nullShape: boolean): GeometryResult {
  if (!hole.enabled || nullShape) return result

  const center = centroid(outline)
  const holeRaw = buildShapeOutline(hole.shape)
  const holePoly = translatePolygon(holeRaw, center.x + hole.offsetX, center.y + hole.offsetY)

  let clearance = holePoly
  if (hole.margin > 0) {
    const grown = outset(holePoly, hole.margin, 'round')[0]
    if (grown && grown.length >= 3) clearance = grown
  }

  let cutPaths = differencePolys(result.cutPaths, [clearance])
  const etchPaths = differencePolys(result.etchPaths, [clearance])
  let detailEtchPaths = differencePolys(result.detailEtchPaths, [clearance])

  // Rim edge detail: a decorative motif banded around the hole itself,
  // extending OUTWARD into the surrounding solid (sign -1 — the hole's own
  // interior is the void, not the material), clipped to the panel's true
  // outline in case the hole sits near its edge.
  if (hole.edgeDetail.enabled) {
    const motifs = intersectPolys(buildEdgeDetailPolys(holePoly, hole.edgeDetail, -1), [outline])
    if (hole.edgeDetail.mode === 'cut') {
      cutPaths = unionPolys([...cutPaths, ...motifs])
    } else {
      detailEtchPaths = unionPolys([...detailEtchPaths, ...motifs])
    }
  }

  const cutAreaMm2 = cutPaths.reduce((sum, p) => sum + area(p), 0)

  return {
    ...result,
    outline: [...result.outline, holePoly],
    cutPaths,
    etchPaths,
    detailEtchPaths,
    stats: {
      ...result.stats,
      cutAreaMm2,
      // Exact, not an approximation: `outline` here is the whole shape's
      // own boundary (no holes), so area(outline) - cutAreaMm2 accounts
      // for the hole, the margin clearance, and any edge-detail motifs
      // all at once, however they interact.
      materialAreaMm2: Math.max(0, area(outline) - cutAreaMm2),
    },
  }
}

export function computeComponentGeometry(component: StageComponent): GeometryResult {
  const outline = buildShapeOutline(component.shape)
  const result = computePatternGeometry(outline, component.pattern)
  return applyCenterHole(result, outline, component.centerHole, component.pattern.nullShape)
}
