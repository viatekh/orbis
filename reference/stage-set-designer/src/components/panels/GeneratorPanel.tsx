import { NumberField } from '../shared/NumberField'
import { Select } from '../shared/Select'
import { HideScope } from '../shared/HideScope'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { useDesignerStore } from '../../store/designerStore'
import { RadialGeneratorPanel } from './RadialGeneratorPanel'
import { GridGeneratorPanel } from './GridGeneratorPanel'
import { ManualInstancesPanel } from './ManualInstancesPanel'
import type { Arrangement, ArrangementLayer, BooleanMode, PlacementGenerator } from '../../types'

const KIND_OPTIONS: { value: PlacementGenerator['kind']; label: string }[] = [
  { value: 'radial', label: 'Radial array' },
  { value: 'grid', label: 'Grid tiling' },
  { value: 'manual', label: 'Manual' },
]

const COMBINE_MODE_OPTIONS: { value: BooleanMode; label: string }[] = [
  { value: 'none', label: 'None (independent)' },
  { value: 'union', label: 'Union' },
  { value: 'subtract', label: 'Subtract' },
  { value: 'intersect', label: 'Intersect' },
  { value: 'exclude', label: 'Exclude (XOR)' },
]

const COMBINE_MODE_HELP: Record<BooleanMode, string> = {
  none: 'Instances stay fully independent and may visually overlap.',
  union: "Overlapping instances fuse into one outline. Each instance's own pattern is preserved — a hole only survives where no other instance has solid material there.",
  subtract: 'The first instance is the base; every later instance punches its full silhouette out of it, in order.',
  intersect: 'Only the region common to every instance survives.',
  exclude: 'The overlap itself becomes a cutout — regions covered by an odd number of instances stay solid, evenly-covered regions are removed.',
}

/** Dispatches on `layer.generator.kind` to the matching per-kind panel
 * (Radial/Grid/Manual — see PlacementGenerator in lib/geometry/types.ts),
 * plus the kind switcher and the generator-agnostic combineMode/depth
 * fields shared by all three. Combine modes other than 'none' only make
 * physical sense across coplanar instances — switching kind resets to
 * 'none' (see setLayerGeneratorKind) rather than silently carrying over a
 * boolean mode that would produce a geometrically wrong result on a
 * non-coplanar Manual layer. */
export function GeneratorPanel({ arrangement, layer }: { arrangement: Arrangement; layer: ArrangementLayer }) {
  const setLayerGeneratorKind = useDesignerStore((s) => s.setLayerGeneratorKind)
  const updateLayer = useDesignerStore((s) => s.updateLayer)
  const { generator } = layer

  return (
    <HideScope name="generator">
      <CollapsibleSection id="generator" title="Placement">
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Generator</span>
          <Select
            hideKey="Generator kind"
            value={generator.kind}
            options={KIND_OPTIONS}
            onChange={(kind) => setLayerGeneratorKind(arrangement.id, layer.id, kind)}
          />
        </div>

        {generator.kind === 'radial' && <RadialGeneratorPanel arrangement={arrangement} layer={layer} generator={generator} />}
        {generator.kind === 'grid' && <GridGeneratorPanel arrangement={arrangement} layer={layer} generator={generator} />}
        {generator.kind === 'manual' && <ManualInstancesPanel arrangement={arrangement} layer={layer} generator={generator} />}

        <div className="h-px bg-neutral-800" />

        <div className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Combine overlapping instances</span>
          <Select
            hideKey="Combine overlapping instances"
            value={layer.combineMode}
            options={COMBINE_MODE_OPTIONS}
            onChange={(combineMode) => updateLayer(arrangement.id, layer.id, { combineMode })}
          />
        </div>
        <p className="-mt-2 text-xs text-neutral-500">{COMBINE_MODE_HELP[layer.combineMode]}</p>

        <div className="h-px bg-neutral-800" />

        <NumberField
          label="Depth"
          value={layer.depth}
          min={0}
          max={2000}
          step={1}
          suffix="mm"
          onChange={(depth) => updateLayer(arrangement.id, layer.id, { depth })}
        />
        <p className="-mt-2 text-xs text-neutral-500">
          This layer's own Z-offset from the base, in the 3D preview — moves only this layer, not any other. Above 0,
          assembly fins are also generated standing out from this layer's own outline, tall enough to bridge that gap.
        </p>
      </CollapsibleSection>
    </HideScope>
  )
}
