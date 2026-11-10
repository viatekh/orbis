import { NumberField } from '../shared/NumberField'
import { HideScope } from '../shared/HideScope'
import { useDesignerStore } from '../../store/designerStore'
import type { Arrangement, ArrangementLayer, GridGenerator } from '../../types'

/** A flat rows×cols tiling — for a tessellated facade rather than a ring
 * (see GridGenerator's doc comment in lib/geometry/types.ts). */
export function GridGeneratorPanel({
  arrangement,
  layer,
  generator,
}: {
  arrangement: Arrangement
  layer: ArrangementLayer
  generator: GridGenerator
}) {
  const updateGenerator = useDesignerStore((s) => s.updateGenerator)
  const set = (patch: Partial<GridGenerator>) => updateGenerator(arrangement.id, layer.id, patch)

  return (
    <HideScope name="grid">
      <NumberField label="Rows" value={generator.rows} min={1} max={32} step={1} onChange={(rows) => set({ rows })} />
      <NumberField label="Columns" value={generator.cols} min={1} max={32} step={1} onChange={(cols) => set({ cols })} />

      <NumberField
        label="Spacing X"
        value={generator.spacingX}
        min={1}
        max={2000}
        step={5}
        suffix="mm"
        onChange={(spacingX) => set({ spacingX })}
      />
      <NumberField
        label="Spacing Y"
        value={generator.spacingY}
        min={1}
        max={2000}
        step={5}
        suffix="mm"
        onChange={(spacingY) => set({ spacingY })}
      />

      <NumberField
        label="Row stagger"
        value={generator.staggerOffset}
        min={0}
        max={2000}
        step={5}
        suffix="mm"
        onChange={(staggerOffset) => set({ staggerOffset })}
      />
      <p className="-mt-2 text-xs text-neutral-500">
        Shifts every other row along X, for a brick/honeycomb-style offset instead of a plain grid.
      </p>

      <div className="h-px bg-neutral-800" />

      <NumberField label="Tilt" value={generator.tiltDeg} min={-90} max={90} step={1} suffix="°" onChange={(tiltDeg) => set({ tiltDeg })} />
      <NumberField
        label="Swivel"
        value={generator.swivelDeg}
        min={-90}
        max={90}
        step={1}
        suffix="°"
        onChange={(swivelDeg) => set({ swivelDeg })}
      />
      <p className="-mt-2 text-xs text-neutral-500">
        Cants every tile the same amount on two independent axes — enough to angle a whole facade section. Visible in
        the 3D preview only.
      </p>
    </HideScope>
  )
}
