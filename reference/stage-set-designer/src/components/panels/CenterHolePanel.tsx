import { Shuffle } from 'lucide-react'
import { NumberField } from '../shared/NumberField'
import { Checkbox } from '../shared/Checkbox'
import { HideScope } from '../shared/HideScope'
import { ShapeFields } from '../shared/ShapeFields'
import { EdgeDetailFields } from '../shared/EdgeDetailFields'
import { randomizeShape } from '../shared/randomize'
import { useDesignerStore } from '../../store/designerStore'
import type { StageComponent } from '../../types'

/** A Portal-style opening: enabling this turns the component into a frame
 * around a hole rather than a solid panel — the pattern lattice clips back
 * from the hole automatically. Reuses the exact same shape system as the
 * component's own outline, so the opening can be any shape, not just a
 * circle. */
export function CenterHolePanel({ component }: { component: StageComponent }) {
  const updateCenterHole = useDesignerStore((s) => s.updateCenterHole)
  const hole = component.centerHole

  return (
    <HideScope name="centerHole">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Checkbox
            label="Center hole (Portal)"
            className="font-medium text-neutral-200"
            checked={hole.enabled}
            onChange={(enabled) => updateCenterHole(component.id, { enabled })}
          />
          {hole.enabled && (
            <button
              type="button"
              onClick={() => updateCenterHole(component.id, { shape: randomizeShape(hole.shape) })}
              className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
              title="Randomize hole shape parameters"
            >
              <Shuffle size={12} />
              Randomize
            </button>
          )}
        </div>
        <p className="-mt-2 text-xs text-neutral-500">
          Cuts an opening through the middle of the panel — the pattern lattice stops at its edge, turning the
          component into a frame around it.
        </p>

        {hole.enabled && (
          <>
            <ShapeFields
              shape={hole.shape}
              onChange={(shape) => updateCenterHole(component.id, { shape })}
              compact
            />

            <div className="h-px bg-neutral-800" />

            <NumberField
              label="Margin"
              value={hole.margin}
              min={0}
              max={200}
              step={1}
              suffix="mm"
              onChange={(margin) => updateCenterHole(component.id, { margin })}
            />
            <p className="-mt-2 text-xs text-neutral-500">
              Extra clearance kept clear of the opening's edge — a solid collar before the pattern lattice starts,
              rather than cells cutting right up against the hole.
            </p>

            <NumberField
              label="Offset X"
              value={hole.offsetX}
              min={-500}
              max={500}
              step={1}
              suffix="mm"
              onChange={(offsetX) => updateCenterHole(component.id, { offsetX })}
            />
            <NumberField
              label="Offset Y"
              value={hole.offsetY}
              min={-500}
              max={500}
              step={1}
              suffix="mm"
              onChange={(offsetY) => updateCenterHole(component.id, { offsetY })}
            />

            <div className="h-px bg-neutral-800" />

            <Checkbox
              label="Rim edge detail"
              className="font-medium text-neutral-200"
              checked={hole.edgeDetail.enabled}
              onChange={(enabled) => updateCenterHole(component.id, { edgeDetail: { ...hole.edgeDetail, enabled } })}
            />
            <p className="-mt-2 text-xs text-neutral-500">
              A decorative motif banded around the hole's own rim, sitting inside the margin collar.
            </p>
            {hole.edgeDetail.enabled && (
              <EdgeDetailFields
                config={hole.edgeDetail}
                onChange={(patch) => updateCenterHole(component.id, { edgeDetail: { ...hole.edgeDetail, ...patch } })}
              />
            )}
          </>
        )}
      </div>
    </HideScope>
  )
}
