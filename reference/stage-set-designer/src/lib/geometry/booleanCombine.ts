import { differencePolys, intersectPolys, unionPolys, xorPolys } from './clipper'
import type { BooleanMode, Polygon } from './types'

export interface CombineInstance {
  outline: Polygon[]
  cutPaths: Polygon[]
  etchPaths: Polygon[]
  detailEtchPaths: Polygon[]
}

export interface CombineResult {
  outline: Polygon[]
  cutPaths: Polygon[]
  etchPaths: Polygon[]
  detailEtchPaths: Polygon[]
}

type SetMode = Extract<BooleanMode, 'union' | 'intersect' | 'exclude'>

/** Combines groups of polygons (one group per instance) with a plain set
 * operation — 'subtract' is handled separately in combineInstances because
 * its material computation needs a different clip set than its outline
 * computation (see below), so it doesn't fit this uniform shape. */
function combineGroups(mode: SetMode, groups: Polygon[][]): Polygon[] {
  switch (mode) {
    case 'union':
      return unionPolys(groups.flat())
    case 'intersect':
      return groups.slice(1).reduce((acc, g) => intersectPolys(acc, g), groups[0])
    case 'exclude':
      // XOR (symmetric difference) is associative, so pairwise-chaining
      // across N groups computes the exact N-way "odd coverage" result.
      return groups.slice(1).reduce((acc, g) => xorPolys(acc, g), groups[0])
  }
}

function intersectEach(polys: Polygon[], clip: Polygon[]): Polygon[] {
  return polys.flatMap((p) => intersectPolys([p], clip))
}

/** Pure. Combines N instances of the same component into one Pathfinder-
 * style result. `isEtchMode` controls whether cut-paths (material removal)
 * or etch-paths (surface score lines, material never removed) are produced.
 *
 * `combinedOutline` and `combinedMaterial` are always computed with the
 * SAME clip inputs (just a different subject for material), which
 * guarantees material can never end up outside the outline:
 *
 *   union:     everything merges; material fills gaps where one instance's
 *              hole overlaps another instance's solid material
 *   subtract:  the first instance, minus every later instance's full
 *              silhouette (their own pattern doesn't save them — they're
 *              removed entirely); the base's own cut-holes are preserved
 *   intersect: only the region common to every instance
 *   exclude:   only the region covered by an ODD number of instances —
 *              the overlap itself becomes a cutout */
export function combineInstances(mode: BooleanMode, instances: CombineInstance[], isEtchMode: boolean): CombineResult {
  if (instances.length === 0) return { outline: [], cutPaths: [], etchPaths: [], detailEtchPaths: [] }
  if (instances.length === 1 || mode === 'none') {
    return {
      outline: instances.flatMap((i) => i.outline),
      cutPaths: instances.flatMap((i) => i.cutPaths),
      etchPaths: instances.flatMap((i) => i.etchPaths),
      detailEtchPaths: instances.flatMap((i) => i.detailEtchPaths),
    }
  }

  const outlineGroups = instances.map((i) => i.outline)
  // Etch never removes material, so an instance's "material" is just its
  // full outline — this makes combinedMaterial equal combinedOutline for
  // every mode, which correctly yields zero cut-paths for etch below.
  const materialGroups = instances.map((i) => (isEtchMode ? i.outline : differencePolys(i.outline, i.cutPaths)))

  let combinedOutline: Polygon[]
  let combinedMaterial: Polygon[]

  if (mode === 'subtract') {
    const laterOutlines = outlineGroups.slice(1).flat()
    combinedOutline = differencePolys(outlineGroups[0], laterOutlines)
    combinedMaterial = differencePolys(materialGroups[0], laterOutlines)
  } else {
    combinedOutline = combineGroups(mode, outlineGroups)
    combinedMaterial =
      mode === 'union' ? unionPolys(materialGroups.flat()) : intersectPolys(combinedOutline, unionPolys(materialGroups.flat()))
  }

  // Detail etch is decorative-only and never removes material, so — in
  // either mode — it should only survive where solid material actually
  // ends up. `combinedMaterial` already equals `combinedOutline` in etch
  // mode (see the comment above), so this one clip is correct for both.
  const allDetailEtch = instances.flatMap((i) => i.detailEtchPaths)
  const detailEtchPaths = intersectEach(allDetailEtch, combinedMaterial)

  if (isEtchMode) {
    const allEtch = instances.flatMap((i) => i.etchPaths)
    return { outline: combinedOutline, cutPaths: [], etchPaths: intersectEach(allEtch, combinedOutline), detailEtchPaths }
  }

  const finalCutPaths = differencePolys(combinedOutline, combinedMaterial)
  return { outline: combinedOutline, cutPaths: finalCutPaths, etchPaths: [], detailEtchPaths }
}
