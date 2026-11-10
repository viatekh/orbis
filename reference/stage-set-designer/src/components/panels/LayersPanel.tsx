import { useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useDesignerStore } from '../../store/designerStore'
import { cn } from '../../lib/utils'
import type { Arrangement } from '../../types'

export function LayersPanel({ arrangement }: { arrangement: Arrangement }) {
  const components = useDesignerStore((s) => s.project.components)
  const activeLayerId = useDesignerStore((s) => s.activeLayerId)
  const addLayer = useDesignerStore((s) => s.addLayer)
  const removeLayer = useDesignerStore((s) => s.removeLayer)
  const renameLayer = useDesignerStore((s) => s.renameLayer)
  const updateLayer = useDesignerStore((s) => s.updateLayer)
  const toggleLayerVisibility = useDesignerStore((s) => s.toggleLayerVisibility)
  const moveLayerForward = useDesignerStore((s) => s.moveLayerForward)
  const moveLayerBackward = useDesignerStore((s) => s.moveLayerBackward)
  const reorderLayer = useDesignerStore((s) => s.reorderLayer)
  const setActiveLayer = useDesignerStore((s) => s.setActiveLayer)

  // Drag-and-drop reordering: dragging is initiated only from the grip
  // handle (not the whole row) so it doesn't fight with clicking the
  // rename field, component select, or the action buttons. `dragOverId`
  // just drives the drop-target highlight.
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Front-most layer (last in the array) shown at the top of the list —
  // standard layers-panel convention (Illustrator/Photoshop).
  const frontToBack = [...arrangement.layers].reverse()

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-200">Layers</h3>
        <button
          type="button"
          onClick={() => addLayer(arrangement.id)}
          disabled={components.length === 0}
          className="rounded-md p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30"
          title="Add layer"
        >
          <Plus size={16} />
        </button>
      </div>

      {arrangement.layers.length === 0 && (
        <p className="text-xs text-neutral-500">No layers yet — add one and pick which component it repeats.</p>
      )}

      <div className="flex flex-col gap-1">
        {frontToBack.map((layer, displayIndex) => {
          const component = components.find((c) => c.id === layer.componentId)
          const isFront = displayIndex === 0
          const isBack = displayIndex === frontToBack.length - 1
          return (
            <div
              key={layer.id}
              onDragOver={(e) => {
                if (!draggedId || draggedId === layer.id) return
                e.preventDefault()
                setDragOverId(layer.id)
              }}
              onDragLeave={() => setDragOverId((id) => (id === layer.id ? null : id))}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedId && draggedId !== layer.id) reorderLayer(arrangement.id, draggedId, layer.id)
                setDraggedId(null)
                setDragOverId(null)
              }}
              className={cn(
                'flex flex-col gap-1.5 rounded-md px-2 py-1.5 border-t-2',
                layer.id === activeLayerId ? 'bg-purple-500/20' : 'hover:bg-neutral-800',
                dragOverId === layer.id ? 'border-purple-500' : 'border-transparent',
                draggedId === layer.id && 'opacity-40',
              )}
            >
              <div className="flex items-center gap-1">
                <span
                  draggable
                  onDragStart={(e) => {
                    setDraggedId(layer.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setDraggedId(null)
                    setDragOverId(null)
                  }}
                  className="cursor-grab text-neutral-600 hover:text-neutral-300 active:cursor-grabbing"
                  title="Drag to reorder"
                >
                  <GripVertical size={13} />
                </span>
                <button
                  type="button"
                  onClick={() => toggleLayerVisibility(arrangement.id, layer.id)}
                  className="rounded p-1 text-neutral-400 hover:text-neutral-200"
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                >
                  {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <input
                  value={layer.name}
                  onChange={(e) => renameLayer(arrangement.id, layer.id, e.target.value)}
                  onFocus={() => setActiveLayer(arrangement.id, layer.id)}
                  className={cn(
                    'flex-1 truncate bg-transparent text-sm outline-none',
                    layer.id === activeLayerId ? 'text-purple-200' : 'text-neutral-300',
                  )}
                />
                <button
                  type="button"
                  onClick={() => moveLayerForward(arrangement.id, layer.id)}
                  disabled={isFront}
                  className="rounded p-1 text-neutral-500 hover:text-neutral-200 disabled:opacity-20"
                  title="Bring forward"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => moveLayerBackward(arrangement.id, layer.id)}
                  disabled={isBack}
                  className="rounded p-1 text-neutral-500 hover:text-neutral-200 disabled:opacity-20"
                  title="Send backward"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete "${layer.name}"?`)) removeLayer(arrangement.id, layer.id)
                  }}
                  className="rounded p-1 text-neutral-500 hover:text-red-400"
                  title="Delete layer"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex items-center gap-1.5 pl-6">
                {!component && (
                  <span title="Referenced component was deleted" className="text-amber-400">
                    <AlertTriangle size={13} />
                  </span>
                )}
                <select
                  value={layer.componentId}
                  onChange={(e) => updateLayer(arrangement.id, layer.id, { componentId: e.target.value })}
                  onFocus={() => setActiveLayer(arrangement.id, layer.id)}
                  className="w-full rounded border border-neutral-700 bg-neutral-900 px-1.5 py-1 text-xs text-neutral-300 outline-none focus:border-purple-500"
                >
                  {!component && <option value={layer.componentId}>Missing component</option>}
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
