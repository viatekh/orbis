import { intersectPolys } from '../clipper'
import { bounds } from '../polygon'
import { buildRibbonFromCenterline } from '../ribbon'
import { conformAngleToBoundary } from '../boundaryConform'
import type { Point, Polygon } from '../types'
import type { PatternContext, PatternGenerator } from './types'

interface Branch {
  start: Point
  angle: number
  length: number
  width: number
  depth: number
}

/** Recursive leaf-vein skeleton: a spine along the boundary's longer axis
 * (so it reaches across the shape regardless of aspect ratio, rather than a
 * fully random orientation that might mostly run off the edge), throwing
 * off shorter, thinner branches at every step which themselves branch
 * again — classic fishbone/fern structure. Branch side alternates
 * left/right for even bilateral coverage, with jitter perturbing the
 * spread angle and length for an organic (non-mechanical) look. Each
 * branch is walked in `cellSize`-long steps and each step becomes its own
 * tapered ribbon cell, so thickness falls off smoothly both along a branch
 * and with recursion depth. */
export const generateVeinCells: PatternGenerator = (ctx: PatternContext): Polygon[] => {
  const { boundary, origin, cellSize, config, rng, patternMaxRadius } = ctx
  if (cellSize <= 0 || patternMaxRadius <= 0) return []
  const jitter = config.jitter

  const b = bounds(boundary)
  const axisAngle = b.maxX - b.minX >= b.maxY - b.minY ? 0 : Math.PI / 2
  const baseAngle = axisAngle + (rng() - 0.5) * 0.3
  const spineHalfLen = patternMaxRadius * 1.4
  const spineWidth = Math.max(cellSize * 0.45, 0.5)
  const stepLen = cellSize
  const maxDepth = 4
  const edgeInfluence = cellSize * 3

  const cells: Polygon[] = []
  const pushRibbon = (a: Point, b2: Point, w0: number, w1: number) => {
    const ribbon = buildRibbonFromCenterline([a, b2], (i) => (i === 0 ? w0 : w1) / 2)
    for (const c of intersectPolys([ribbon], [boundary])) if (c.length >= 3) cells.push(c)
  }

  const queue: Branch[] = [
    { start: origin, angle: baseAngle, length: spineHalfLen, width: spineWidth, depth: 0 },
    { start: origin, angle: baseAngle + Math.PI, length: spineHalfLen, width: spineWidth, depth: 0 },
  ]

  let guard = 0
  while (queue.length > 0 && guard < 6000) {
    guard++
    const branch = queue.shift()!
    if (branch.length < stepLen * 0.6 || branch.width < 0.5 || branch.depth > maxDepth) continue

    const steps = Math.max(1, Math.round(branch.length / stepLen))
    let cur = branch.start
    let angle = branch.angle
    let branchToggle = branch.depth
    for (let i = 0; i < steps; i++) {
      // Bends toward the nearest edge as the branch gets close to it — a
      // vein nearing the shape's silhouette curves to follow it rather
      // than running straight through, the same way a real leaf's veins do.
      angle = conformAngleToBoundary(boundary, cur, angle, edgeInfluence, 0.5)
      const t0 = i / steps
      const t1 = (i + 1) / steps
      const w0 = branch.width * (1 - t0) ** 0.55 + 0.3
      const w1 = branch.width * (1 - t1) ** 0.55 + 0.3
      const next: Point = {
        x: cur.x + Math.cos(angle) * stepLen,
        y: cur.y + Math.sin(angle) * stepLen,
      }
      pushRibbon(cur, next, w0, w1)

      if (i > 0 && branch.depth < maxDepth) {
        branchToggle++
        const side = branchToggle % 2 === 0 ? -1 : 1
        const spread = (0.5 + rng() * 0.35) * (Math.PI / 2)
        queue.push({
          start: next,
          angle: angle + side * spread,
          length: branch.length * (0.5 + rng() * 0.2) * (0.85 + jitter * 0.3),
          width: branch.width * 0.6,
          depth: branch.depth + 1,
        })
      }
      cur = next
    }
  }

  return cells
}
