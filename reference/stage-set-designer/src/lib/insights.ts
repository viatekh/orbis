import type { ShapePrimitive, PatternConfig } from './geometry/types'
import type { RatingEntry } from '../store/ratingsStore'

interface FlatValue {
  path: string
  value: number | string | boolean
}

/** Walks a params object down to scalar leaves, dotted-path-naming each one
 * (e.g. `pattern.dispersion.sizeVariance`). Arrays are skipped entirely —
 * the one array-valued leaf in this app's params is a freeform shape's
 * point list, which isn't a control with a meaningful single range/value to
 * aggregate. */
function flatten(obj: unknown, prefix: string): FlatValue[] {
  if (obj === null || obj === undefined || Array.isArray(obj)) return []
  if (typeof obj === 'number' || typeof obj === 'string' || typeof obj === 'boolean') {
    return [{ path: prefix, value: obj }]
  }
  if (typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k))
  }
  return []
}

function flattenParams(shape: ShapePrimitive, pattern: PatternConfig): FlatValue[] {
  return [...flatten(shape, 'shape'), ...flatten(pattern, 'pattern')]
}

export interface NumericStat {
  path: string
  count: number
  min: number
  max: number
  mean: number
}

/** For every numeric leaf across all params, the observed range/average
 * among the given rated entries — meant to be compared side by side for a
 * 'good' subset vs the full rated set, to spot a control whose well-liked
 * values cluster away from its full slider range (a candidate to rescale
 * or narrow). Doesn't know each control's declared min/max itself — those
 * live per call-site in the panel components, not in a central registry —
 * so that comparison is left to whoever's reading this (a person, or a
 * future pass that adds such a registry), not computed here. */
export function summarizeNumeric(entries: RatingEntry[]): NumericStat[] {
  const byPath = new Map<string, number[]>()
  for (const e of entries) {
    for (const fv of flattenParams(e.shape, e.pattern)) {
      if (typeof fv.value !== 'number' || !Number.isFinite(fv.value)) continue
      const list = byPath.get(fv.path)
      if (list) list.push(fv.value)
      else byPath.set(fv.path, [fv.value])
    }
  }
  const result: NumericStat[] = []
  for (const [path, values] of byPath) {
    result.push({
      path,
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((a, b) => a + b, 0) / values.length,
    })
  }
  return result.sort((a, b) => a.path.localeCompare(b.path))
}

export interface CategoricalStat {
  path: string
  counts: Record<string, number>
}

/** Same idea as summarizeNumeric but for enum/boolean leaves (pattern kind,
 * corner style, dispersion enabled, …) — a frequency table per control,
 * for spotting which kinds/options actually show up among liked designs. */
export function summarizeCategorical(entries: RatingEntry[]): CategoricalStat[] {
  const byPath = new Map<string, Record<string, number>>()
  for (const e of entries) {
    for (const fv of flattenParams(e.shape, e.pattern)) {
      if (typeof fv.value === 'number') continue
      let counts = byPath.get(fv.path)
      if (!counts) {
        counts = {}
        byPath.set(fv.path, counts)
      }
      const key = String(fv.value)
      counts[key] = (counts[key] ?? 0) + 1
    }
  }
  return [...byPath.entries()].map(([path, counts]) => ({ path, counts })).sort((a, b) => a.path.localeCompare(b.path))
}
