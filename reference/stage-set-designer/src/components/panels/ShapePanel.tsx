import { Shuffle } from 'lucide-react'
import { ShapeFields } from '../shared/ShapeFields'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { randomizeShape } from '../shared/randomize'
import { useDesignerStore } from '../../store/designerStore'
import type { StageComponent } from '../../types'

export function ShapePanel({ component }: { component: StageComponent }) {
  const updateShape = useDesignerStore((s) => s.updateShape)

  return (
    <CollapsibleSection
      id="shape"
      title="Shape"
      headerRight={
        <button
          type="button"
          onClick={() => updateShape(component.id, randomizeShape(component.shape))}
          className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          title="Randomize shape parameters"
        >
          <Shuffle size={12} />
          Randomize
        </button>
      }
    >
      <ShapeFields shape={component.shape} onChange={(shape) => updateShape(component.id, shape)} />
    </CollapsibleSection>
  )
}
