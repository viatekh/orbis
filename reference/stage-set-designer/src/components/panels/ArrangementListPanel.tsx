import { Copy, Plus, Trash2 } from 'lucide-react'
import { useDesignerStore } from '../../store/designerStore'
import { cn } from '../../lib/utils'

export function ArrangementListPanel() {
  const arrangements = useDesignerStore((s) => s.project.arrangements)
  const activeId = useDesignerStore((s) => s.activeArrangementId)
  const setActive = useDesignerStore((s) => s.setActiveArrangement)
  const addArrangement = useDesignerStore((s) => s.addArrangement)
  const duplicateArrangement = useDesignerStore((s) => s.duplicateArrangement)
  const removeArrangement = useDesignerStore((s) => s.removeArrangement)
  const renameArrangement = useDesignerStore((s) => s.renameArrangement)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-200">Arrangements</h3>
        <button
          type="button"
          onClick={addArrangement}
          className="rounded-md p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          title="New arrangement"
        >
          <Plus size={16} />
        </button>
      </div>

      {arrangements.length === 0 && (
        <p className="text-xs text-neutral-500">No arrangements yet — create one to start composing components.</p>
      )}

      <div className="flex flex-col gap-1">
        {arrangements.map((a) => (
          <div
            key={a.id}
            className={cn(
              'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm',
              a.id === activeId ? 'bg-purple-500/20 text-purple-200' : 'text-neutral-300 hover:bg-neutral-800',
            )}
          >
            <input
              value={a.name}
              onChange={(e) => renameArrangement(a.id, e.target.value)}
              onFocus={() => setActive(a.id)}
              className="flex-1 truncate bg-transparent outline-none"
            />
            <button
              type="button"
              onClick={() => duplicateArrangement(a.id)}
              className="rounded p-1 text-neutral-500 opacity-0 hover:text-neutral-200 group-hover:opacity-100"
              title="Duplicate"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`Delete "${a.name}"?`)) removeArrangement(a.id)
              }}
              className="rounded p-1 text-neutral-500 opacity-0 hover:text-red-400 group-hover:opacity-100"
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
