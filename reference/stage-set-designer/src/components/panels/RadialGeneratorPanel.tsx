import { NumberField } from '../shared/NumberField'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Checkbox } from '../shared/Checkbox'
import { HideScope } from '../shared/HideScope'
import { useDesignerStore } from '../../store/designerStore'
import type { Arrangement, ArrangementLayer, RadialGenerator } from '../../types'

const AXIS_OPTIONS: { value: RadialGenerator['axis']; label: string }[] = [
  { value: 'z', label: 'Flat (top-down)' },
  { value: 'x', label: 'Standing (front)' },
  { value: 'y', label: 'Standing (side)' },
]

export function RadialGeneratorPanel({
  arrangement,
  layer,
  generator,
}: {
  arrangement: Arrangement
  layer: ArrangementLayer
  generator: RadialGenerator
}) {
  const updateGenerator = useDesignerStore((s) => s.updateGenerator)
  const set = (patch: Partial<RadialGenerator>) => updateGenerator(arrangement.id, layer.id, patch)

  return (
    <HideScope name="radial">
      <NumberField label="Count" value={generator.count} min={1} max={64} step={1} onChange={(count) => set({ count })} />

      <NumberField
        label="Radius"
        value={generator.radius}
        min={0}
        max={3000}
        step={5}
        suffix="mm"
        onChange={(radius) => set({ radius })}
      />

      <NumberField
        label="Start angle"
        value={generator.startAngle}
        min={0}
        max={360}
        step={1}
        suffix="°"
        onChange={(startAngle) => set({ startAngle })}
      />

      <NumberField
        label="Arc span"
        value={generator.arcSpan}
        min={1}
        max={360}
        step={1}
        suffix="°"
        onChange={(arcSpan) => set({ arcSpan })}
      />

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">Orientation</span>
        <SegmentedControl
          hideKey="Orientation"
          value={generator.autoOrient ? 'auto' : 'fixed'}
          options={[
            { value: 'auto', label: 'Face outward' },
            { value: 'fixed', label: 'Fixed' },
          ]}
          onChange={(v) => set({ autoOrient: v === 'auto' })}
        />
      </div>

      <NumberField
        label="Rotation offset"
        value={generator.instanceRotation}
        min={-180}
        max={180}
        step={1}
        suffix="°"
        onChange={(instanceRotation) => set({ instanceRotation })}
      />
      <p className="-mt-2 text-xs text-neutral-500">
        {generator.autoOrient
          ? "If the shape's own \"up\" isn't already facing outward, dial that in here."
          : 'Rotates every instance by the same fixed amount.'}
      </p>

      <Checkbox
        label="Mirror every other instance"
        className="text-neutral-300"
        checked={generator.alternateMirror}
        onChange={(alternateMirror) => set({ alternateMirror })}
      />

      <div className="h-px bg-neutral-800" />

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">Ring plane</span>
        <SegmentedControl hideKey="Ring plane" value={generator.axis} options={AXIS_OPTIONS} onChange={(axis) => set({ axis })} />
      </div>
      <p className="-mt-2 text-xs text-neutral-500">
        Which plane the ring itself lies in — flat for a top-down wheel, standing for a totem or crown ring.
      </p>

      <NumberField
        label="Tilt (in / out)"
        value={generator.tiltDeg}
        min={-90}
        max={90}
        step={1}
        suffix="°"
        onChange={(tiltDeg) => set({ tiltDeg })}
      />
      <p className="-mt-2 text-xs text-neutral-500">
        Cants every instance outward (positive) or inward (negative) around its own facing direction — e.g. petals
        canted out from a dome rather than lying flat. Visible in the 3D preview; the flat canvas doesn't render it.
      </p>

      <NumberField
        label="Swivel (lean)"
        value={generator.swivelDeg}
        min={-90}
        max={90}
        step={1}
        suffix="°"
        onChange={(swivelDeg) => set({ swivelDeg })}
      />
      <p className="-mt-2 text-xs text-neutral-500">
        A second, independent cant — leans every instance sideways around its own facing direction, on top of Tilt.
        Combine both for a compound cant rather than a single axis.
      </p>
    </HideScope>
  )
}
