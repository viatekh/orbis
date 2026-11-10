import { Dices } from 'lucide-react'
import { randomizeShapeFully, randomizePatternFully } from '../shared/randomize'
import { useDesignerStore } from '../../store/designerStore'
import type { StageComponent } from '../../types'

export function RandomizeAllButton({ component }: { component: StageComponent }) {
  const updateShape = useDesignerStore((s) => s.updateShape)
  const updatePattern = useDesignerStore((s) => s.updatePattern)

  const handleClick = () => {
    updateShape(component.id, randomizeShapeFully())
    updatePattern(component.id, randomizePatternFully(component.pattern))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center justify-center gap-2 rounded-md bg-purple-500 px-3 py-2 text-sm font-medium text-white hover:bg-purple-400"
      title="Randomize shape and pattern together"
    >
      <Dices size={15} />
      Randomize all
    </button>
  )
}
