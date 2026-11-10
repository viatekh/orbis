import { triangulateWithHoles } from '../geometry/triangulate'
import { centroid } from '../geometry/polygon'
import { downloadBlob } from '../utils'
import type { GeometryResult, Point, Polygon } from '../geometry/types'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Tri3 {
  a: Vec3
  b: Vec3
  c: Vec3
}

function lift(p: Point, z: number): Vec3 {
  return { x: p.x, y: p.y, z }
}

function normal(a: Vec3, b: Vec3, c: Vec3): Vec3 {
  const ux = b.x - a.x
  const uy = b.y - a.y
  const uz = b.z - a.z
  const vx = c.x - a.x
  const vy = c.y - a.y
  const vz = c.z - a.z
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const len = Math.hypot(nx, ny, nz) || 1
  return { x: nx / len, y: ny / len, z: nz / len }
}

/** Builds a triangle with whichever winding (a,b,c) vs (a,c,b) makes its
 * normal agree with `wantPositive(normal)` — rather than hand-deriving the
 * "correct" vertex order for every face/wall/wind case by pure reasoning
 * (error-prone), this just computes the actual geometric normal and flips
 * if it points the wrong way. Self-correcting regardless of how the caller
 * happened to order its input points. */
function orientedTri(a: Vec3, b: Vec3, c: Vec3, wantPositive: (n: Vec3) => number): Tri3 {
  const n = normal(a, b, c)
  return wantPositive(n) < 0 ? { a, b: c, c: b } : { a, b, c }
}

function faceFromTriangles2D(triangles2D: Polygon[], z: number, wantPositive: (n: Vec3) => number): Tri3[] {
  return triangles2D.map(([p0, p1, p2]) => orientedTri(lift(p0, z), lift(p1, z), lift(p2, z), wantPositive))
}

/** Side walls for one closed 2D loop, extruded between z0 and z1 — used
 * both for the outer boundary (should face outward from the solid) and for
 * a hole's boundary (should face inward, into the void it cuts). Which one
 * is which is decided the same self-correcting way as `orientedTri`: pass
 * a reference point the wall should face TOWARD (a hole's own center) or
 * AWAY from (the whole shape's center, negated) via `wantPositive`. */
function wallsForLoop(loop: Polygon, z0: number, z1: number, wantPositive: (n: Vec3) => number): Tri3[] {
  const tris: Tri3[] = []
  const n = loop.length
  for (let i = 0; i < n; i++) {
    const p0 = loop[i]
    const p1 = loop[(i + 1) % n]
    const a = lift(p0, z0)
    const b = lift(p1, z0)
    const c = lift(p1, z1)
    const d = lift(p0, z1)
    tris.push(orientedTri(a, b, c, wantPositive))
    tris.push(orientedTri(a, c, d, wantPositive))
  }
  return tris
}

/** A single closed region, extruded from its own base Z up to its own top
 * Z with walls all around, plus a flat cap at the top (used for both the
 * flat panel — z0=0, z1=thickness — and an embossed detail piece sitting
 * on top of it — z0=thickness, z1=thickness+embossHeight). */
function extrudeRegion(outer: Polygon, holes: Polygon[], z0: number, z1: number): Tri3[] {
  const cap2D = triangulateWithHoles(outer, holes)
  const c = centroid(outer)
  const tris: Tri3[] = []

  tris.push(...faceFromTriangles2D(cap2D, z1, (n) => n.z)) // top cap, facing +Z
  tris.push(...faceFromTriangles2D(cap2D, z0, (n) => -n.z)) // bottom cap, facing -Z

  const outerWallWant = (n: Vec3): number => {
    const mid = { x: (outer[0].x + outer[Math.floor(outer.length / 2)].x) / 2, y: (outer[0].y + outer[Math.floor(outer.length / 2)].y) / 2 }
    return n.x * (mid.x - c.x) + n.y * (mid.y - c.y)
  }
  tris.push(...wallsForLoop(outer, z0, z1, outerWallWant))

  for (const hole of holes) {
    if (hole.length < 3) continue
    const holeCenter = centroid(hole)
    const holeWallWant = (n: Vec3): number => {
      const mid = { x: (hole[0].x + hole[Math.floor(hole.length / 2)].x) / 2, y: (hole[0].y + hole[Math.floor(hole.length / 2)].y) / 2 }
      return n.x * (holeCenter.x - mid.x) + n.y * (holeCenter.y - mid.y)
    }
    tris.push(...wallsForLoop(hole, z0, z1, holeWallWant))
  }

  return tris
}

const MAX_EXPORT_VERTICES = 4000

/** Total vertex count across everything that would need triangulating —
 * used to warn before attempting a build likely to hang the tab, since
 * ear-clipping is superlinear and a very dense pattern (thousands of
 * cells) can realistically take too long in a browser tab. */
export function estimateStlComplexity(geometry: GeometryResult): { vertices: number; overBudget: boolean } {
  const holes = [...geometry.outline.slice(1), ...geometry.cutPaths]
  const embossPieces = [...geometry.etchPaths, ...geometry.detailEtchPaths]
  const vertices =
    geometry.outline[0].length +
    holes.reduce((s, h) => s + h.length, 0) +
    embossPieces.reduce((s, p) => s + p.length, 0)
  return { vertices, overBudget: vertices > MAX_EXPORT_VERTICES }
}

/** Builds a printable solid: the panel extruded to `thicknessMm`, with the
 * pattern's own cut cells and any center hole as REAL through-holes (not
 * just outlines), and every etch region — the main pattern in etch mode,
 * plus the independent surface-detail layer — raised as an embossed cap
 * sitting on top of the panel by `embossHeightMm`, rather than a flat
 * engraved line. */
export function buildComponentMesh(geometry: GeometryResult, thicknessMm: number, embossHeightMm: number): Tri3[] {
  const outer = geometry.outline[0]
  if (!outer || outer.length < 3) return []

  const throughHoles = [...geometry.outline.slice(1), ...geometry.cutPaths]
  const tris = extrudeRegion(outer, throughHoles, 0, thicknessMm)

  const embossPieces = [...geometry.etchPaths, ...geometry.detailEtchPaths]
  for (const piece of embossPieces) {
    if (piece.length < 3) continue
    tris.push(...extrudeRegion(piece, [], thicknessMm, thicknessMm + embossHeightMm))
  }

  return tris
}

function formatNum(n: number): string {
  return Number.isFinite(n) ? n.toFixed(4) : '0.0000'
}

function trianglesToAsciiStl(tris: Tri3[], name: string): string {
  const lines: string[] = [`solid ${name}`]
  for (const t of tris) {
    const n = normal(t.a, t.b, t.c)
    lines.push(`facet normal ${formatNum(n.x)} ${formatNum(n.y)} ${formatNum(n.z)}`)
    lines.push('  outer loop')
    lines.push(`    vertex ${formatNum(t.a.x)} ${formatNum(t.a.y)} ${formatNum(t.a.z)}`)
    lines.push(`    vertex ${formatNum(t.b.x)} ${formatNum(t.b.y)} ${formatNum(t.b.z)}`)
    lines.push(`    vertex ${formatNum(t.c.x)} ${formatNum(t.c.y)} ${formatNum(t.c.z)}`)
    lines.push('  endloop')
    lines.push('endfacet')
  }
  lines.push(`endsolid ${name}`)
  return lines.join('\n')
}

export function downloadComponentStl(geometry: GeometryResult, thicknessMm: number, embossHeightMm: number, filename: string) {
  const tris = buildComponentMesh(geometry, thicknessMm, embossHeightMm)
  const stl = trianglesToAsciiStl(tris, filename.replace(/\.stl$/i, '') || 'component')
  downloadBlob(new Blob([stl], { type: 'model/stl' }), filename)
}
