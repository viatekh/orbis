import { ShapeThumbnail } from './ShapeThumbnail'
import { SHAPE_PRESETS } from './shapePresets'
import type { ShapePrimitive } from '../../types'

/** A row of clickable example thumbnails for the current shape kind —
 * "what does this parameter actually do" answered visually and triably,
 * rather than by guessing from slider values. Clicking one loads its exact
 * parameters. */
export function ShapePresetGallery({
  kind,
  onSelect,
}: {
  kind: ShapePrimitive['kind']
  onSelect: (shape: ShapePrimitive) => void
}) {
  const presets = SHAPE_PRESETS[kind]
  if (!presets || presets.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-neutral-500">Examples — click to try</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onSelect(preset.shape)}
            className="flex flex-col items-center gap-1 rounded-md border border-neutral-700 p-1.5 hover:border-purple-500 hover:bg-neutral-800"
            title={preset.label}
          >
            <ShapeThumbnail shape={preset.shape} size={48} />
            <span className="max-w-[52px] truncate text-[10px] text-neutral-400">{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
