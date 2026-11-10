import { NumberField } from '../shared/NumberField'
import { Checkbox } from '../shared/Checkbox'
import { HideScope } from '../shared/HideScope'
import type { DispersionConfig } from '../../types'

/** Kept generic over just the dispersion config (rather than a whole
 * StageComponent) for the same reason as RadialEffectsPanel — both the
 * main pattern panel and the surface-detail panel share this UI without
 * either faking the other's shape. */
export function DispersionPanel({
  dispersion,
  onChange,
}: {
  dispersion: DispersionConfig
  onChange: (patch: Partial<DispersionConfig>) => void
}) {
  return (
    <HideScope name="dispersion">
      <div className="flex flex-col gap-4">
        <Checkbox
          label="Dispersion"
          className="font-medium text-neutral-200"
          checked={dispersion.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />

        {dispersion.enabled && (
          <>
            <p className="-mt-2 text-xs text-neutral-500">
              Random per-cell variation, independent of cell size and jitter — cells end up genuinely uneven in both
              size and spacing rather than a jittered-but-still-regular lattice.
            </p>

            <NumberField
              label="Size variance"
              value={dispersion.sizeVariance}
              min={0}
              max={1}
              step={0.05}
              onChange={(sizeVariance) => onChange({ sizeVariance })}
            />
            <NumberField
              label="Distance variance"
              value={dispersion.distanceVariance}
              min={0}
              max={1}
              step={0.05}
              onChange={(distanceVariance) => onChange({ distanceVariance })}
            />
          </>
        )}
      </div>
    </HideScope>
  )
}
