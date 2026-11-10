import { Plus, Trash2 } from 'lucide-react'
import { NumberField } from '../shared/NumberField'
import { Checkbox } from '../shared/Checkbox'
import { HideScope } from '../shared/HideScope'
import { useDesignerStore } from '../../store/designerStore'
import type { Arrangement, ArrangementLayer, Instance3D, ManualGenerator } from '../../types'

const NEW_INSTANCE: Instance3D = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, mirrored: false }

/** No formula — each instance placed and edited directly, for a one-off
 * asymmetric compound build that doesn't fit a radial or grid repeat (see
 * ManualGenerator's doc comment in lib/geometry/types.ts). A plain list of
 * NumberFields rather than anything fancier — this is meant for a handful
 * of hand-placed pieces, not for authoring dozens of instances. */
export function ManualInstancesPanel({
  arrangement,
  layer,
  generator,
}: {
  arrangement: Arrangement
  layer: ArrangementLayer
  generator: ManualGenerator
}) {
  const updateGenerator = useDesignerStore((s) => s.updateGenerator)
  const setInstances = (instances: Instance3D[]) => updateGenerator(arrangement.id, layer.id, { instances })

  const updateInstance = (index: number, patch: Partial<Instance3D>) =>
    setInstances(generator.instances.map((inst, i) => (i === index ? { ...inst, ...patch } : inst)))
  const removeInstance = (index: number) => setInstances(generator.instances.filter((_, i) => i !== index))
  const addInstance = () => setInstances([...generator.instances, { ...NEW_INSTANCE }])

  return (
    <HideScope name="manual">
      <div className="flex flex-col gap-3">
        {generator.instances.map((instance, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-md border border-neutral-800 p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">Instance {i + 1}</span>
              <button
                type="button"
                onClick={() => removeInstance(i)}
                disabled={generator.instances.length <= 1}
                className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-red-400 disabled:opacity-30"
                title="Remove instance"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <NumberField
                label="X"
                slider={false}
                value={instance.x}
                min={-3000}
                max={3000}
                step={1}
                suffix="mm"
                onChange={(x) => updateInstance(i, { x })}
              />
              <NumberField
                label="Y"
                slider={false}
                value={instance.y}
                min={-3000}
                max={3000}
                step={1}
                suffix="mm"
                onChange={(y) => updateInstance(i, { y })}
              />
              <NumberField
                label="Z"
                slider={false}
                value={instance.z}
                min={-3000}
                max={3000}
                step={1}
                suffix="mm"
                onChange={(z) => updateInstance(i, { z })}
              />
              <NumberField
                label="Rot X"
                slider={false}
                value={instance.rotationX}
                min={-180}
                max={180}
                step={1}
                suffix="°"
                onChange={(rotationX) => updateInstance(i, { rotationX })}
              />
              <NumberField
                label="Rot Y"
                slider={false}
                value={instance.rotationY}
                min={-180}
                max={180}
                step={1}
                suffix="°"
                onChange={(rotationY) => updateInstance(i, { rotationY })}
              />
              <NumberField
                label="Rot Z"
                slider={false}
                value={instance.rotationZ}
                min={-180}
                max={180}
                step={1}
                suffix="°"
                onChange={(rotationZ) => updateInstance(i, { rotationZ })}
              />
            </div>

            <Checkbox
              label="Mirrored"
              className="text-neutral-300"
              checked={instance.mirrored}
              onChange={(mirrored) => updateInstance(i, { mirrored })}
            />
          </div>
        ))}

        <button
          type="button"
          onClick={addInstance}
          className="flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800"
        >
          <Plus size={14} />
          Add instance
        </button>

        <p className="text-xs text-neutral-500">
          Z and Rot X/Y describe where this instance sits in 3D — only used by a future 3D preview, not yet rendered
          on today's flat canvas.
        </p>
      </div>
    </HideScope>
  )
}
