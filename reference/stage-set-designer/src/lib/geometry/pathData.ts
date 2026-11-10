import type { Polygon } from './types'

const ROUND_DP = 3

function r(n: number): string {
  return n.toFixed(ROUND_DP)
}

export function polygonToPathData(poly: Polygon): string {
  if (poly.length === 0) return ''
  const [first, ...rest] = poly
  let d = `M${r(first.x)},${r(first.y)} `
  for (const p of rest) d += `L${r(p.x)},${r(p.y)} `
  d += 'Z'
  return d
}

export function polygonsToPathData(polys: Polygon[]): string {
  return polys.map(polygonToPathData).filter(Boolean).join(' ')
}
