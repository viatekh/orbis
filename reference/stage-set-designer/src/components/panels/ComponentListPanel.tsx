import { Copy, Plus, Trash2 } from 'lucide-react'
import { useDesignerStore } from '../../store/designerStore'
import { cn } from '../../lib/utils'

export function ComponentListPanel() {
  const components = useDesignerStore((s) => s.project.components)
  const activeId = useDesignerStore((s) => s.activeComponentId)
  const setActive = useDesignerStore((s) => s.setActiveComponent)
  const addComponent = useDesignerStore((s) => s.addComponent)
  const duplicateComponent = useDesignerStore((s) => s.duplicateComponent)
  const removeComponent = useDesignerStore((s) => s.removeComponent)
  const renameComponent = useDesignerStore((s) => s.renameComponent)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-200">Components</h3>
        <button
          type="button"
          onClick={addComponent}
          className="rounded-md p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          title="New component"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {components.map((c) => (
          <div
            key={c.id}
            className={cn(
              'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm',
              c.id === activeId ? 'bg-purple-500/20 text-purple-200' : 'text-neutral-300 hover:bg-neutral-800',
            )}
          >
            <input
              value={c.name}
              onChange={(e) => renameComponent(c.id, e.target.value)}
              onFocus={() => setActive(c.id)}
              className="flex-1 truncate bg-transparent outline-none"
            />
            <button
              type="button"
              onClick={() => duplicateComponent(c.id)}
              className="rounded p-1 text-neutral-500 opacity-0 hover:text-neutral-200 group-hover:opacity-100"
              title="Duplicate"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (components.length <= 1) return
                if (confirm(`Delete "${c.name}"?`)) removeComponent(c.id)
              }}
              disabled={components.length <= 1}
              className="rounded p-1 text-neutral-500 opacity-0 hover:text-red-400 group-hover:opacity-100 disabled:opacity-30"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
