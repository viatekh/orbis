import { NumberField } from '../shared/NumberField'
import { Checkbox } from '../shared/Checkbox'
import { HideScope } from '../shared/HideScope'
import type { RadialModulationConfig } from '../../types'

/** Kept generic over just the modulation config (rather than a whole
 * StageComponent) so both the main pattern panel and the surface-detail
 * panel — a structurally similar but distinct config living at a different
 * path in the store — can share this UI without one panel faking the
 * other's shape. */
export function RadialEffectsPanel({
  modulation,
  onChange,
}: {
  modulation: RadialModulationConfig
  onChange: (patch: Partial<RadialModulationConfig>) => void
}) {
  const setModulation = onChange

  return (
    <HideScope name="radialEffects">
      <div className="flex flex-col gap-4">
        <Checkbox
          label="Radial effects"
          className="font-medium text-neutral-200"
          checked={modulation.enabled}
          onChange={(enabled) => setModulation({ enabled })}
        />

        {modulation.enabled && (
          <>
            <p className="-mt-2 text-xs text-neutral-500">
              Distance is measured from the shape's own center — cells near the middle behave differently from cells
              near the edge.
            </p>

            <NumberField
              label="Size at center"
              value={modulation.sizeStart}
              min={0.1}
              max={3}
              step={0.05}
              onChange={(sizeStart) => setModulation({ sizeStart })}
            />
            <NumberField
              label="Size at edge"
              value={modulation.sizeEnd}
              min={0.1}
              max={3}
              step={0.05}
              onChange={(sizeEnd) => setModulation({ sizeEnd })}
            />

            <Checkbox
              label="Orient cells to face outward"
              className="text-neutral-300"
              checked={modulation.orientToCenter}
              onChange={(orientToCenter) => setModulation({ orientToCenter })}
            />

            <NumberField
              label="Swirl"
              value={modulation.swirlAmount}
              min={-180}
              max={180}
              step={5}
              suffix="°"
              onChange={(swirlAmount) => setModulation({ swirlAmount })}
            />
            <NumberField
              label="Pinch / taper"
              value={modulation.pinchAmount}
              min={-1}
              max={1}
              step={0.05}
              onChange={(pinchAmount) => setModulation({ pinchAmount })}
            />
            <NumberField
              label="Radial stretch"
              value={modulation.stretchAmount}
              min={-1}
              max={1}
              step={0.05}
              onChange={(stretchAmount) => setModulation({ stretchAmount })}
            />
          </>
        )}
      </div>
    </HideScope>
  )
}
