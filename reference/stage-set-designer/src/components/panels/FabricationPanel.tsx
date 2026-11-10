import { NumberField } from '../shared/NumberField'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Checkbox } from '../shared/Checkbox'
import { HideScope } from '../shared/HideScope'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { useDesignerStore } from '../../store/designerStore'
import type { StageComponent } from '../../types'

export function FabricationPanel({ component }: { component: StageComponent }) {
  const updatePattern = useDesignerStore((s) => s.updatePattern)
  const updateMaterial = useDesignerStore((s) => s.updateMaterial)
  const pattern = component.pattern

  return (
    <HideScope name="fabrication">
      <CollapsibleSection id="fabrication" title="Fabrication">
        <NumberField
          label="Material thickness"
          value={component.material.thicknessMm}
          min={1}
          max={50}
          step={0.5}
          suffix="mm"
          onChange={(thicknessMm) => updateMaterial(component.id, { thicknessMm })}
        />

        <CollapsibleSection id="fabrication.advanced" title="Advanced — kerf, strut minimum, corner style" compact>
          <>
            <NumberField
              label="Kerf compensation"
              value={pattern.kerf}
              min={0}
              max={2}
              step={0.05}
              suffix="mm"
              onChange={(kerf) => updatePattern(component.id, { kerf })}
            />

            <NumberField
              label="Minimum strut width"
              value={pattern.minStrutWidth}
              min={0.5}
              max={10}
              step={0.5}
              suffix="mm"
              onChange={(minStrutWidth) => updatePattern(component.id, { minStrutWidth })}
            />

            <div className="flex flex-col gap-1 text-sm">
              <span className="text-neutral-400">Corner style</span>
              <SegmentedControl
                hideKey="Corner style"
                value={pattern.cornerStyle}
                options={[
                  { value: 'round', label: 'Round' },
                  { value: 'miter', label: 'Miter' },
                ]}
                onChange={(cornerStyle) => updatePattern(component.id, { cornerStyle })}
              />
            </div>

            <Checkbox
              label="Trim sliver cells at boundary"
              className="text-neutral-300"
              checked={pattern.trimSlivers}
              onChange={(trimSlivers) => updatePattern(component.id, { trimSlivers })}
            />
          </>
        </CollapsibleSection>
      </CollapsibleSection>
    </HideScope>
  )
}
