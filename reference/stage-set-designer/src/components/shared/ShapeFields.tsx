import { Shuffle, Spline } from 'lucide-react'
import { NumberField } from './NumberField'
import { Select } from './Select'
import { SegmentedControl } from './SegmentedControl'
import { HideScope } from './HideScope'
import { ShapePresetGallery } from './ShapePresetGallery'
import { SHAPE_OPTIONS, defaultShapeFor, defaultFreeformPoints, mirrorFreeformPoints, convertToFreeform } from './shapeDefaults'
import { useDesignerStore } from '../../store/designerStore'
import type { FreeformPoint, ShapePrimitive } from '../../types'

interface ShapeFieldsProps {
  shape: ShapePrimitive
  onChange: (shape: ShapePrimitive) => void
  /** Shape sizes are much smaller for a repeating pattern motif than a
   * whole component outline — tightens the slider ranges accordingly. */
  compact?: boolean
}

/** Per-shape-kind parameter fields, shared by the component ShapePanel and
 * the stamp-pattern motif picker so both stay in lockstep with the shape
 * system without duplicating ~150 lines of per-kind JSX. Each kind's block
 * gets its own nested HideScope so same-named fields across kinds (e.g.
 * every kind has "Rotation") don't collide on one hide id. */
export function ShapeFields({ shape, onChange, compact = false }: ShapeFieldsProps) {
  const sizeMax = compact ? 200 : 3000
  const radiusMax = compact ? 100 : 1500

  return (
    <HideScope name="shape">
      <>
        <Select value={shape.kind} options={SHAPE_OPTIONS} onChange={(kind) => onChange(defaultShapeFor(kind))} />

        {shape.kind !== 'freeform' && (
          <button
            type="button"
            onClick={() => onChange({ kind: 'freeform', points: convertToFreeform(shape) })}
            title="Turn this shape's current outline into hand-editable freeform points"
            className="flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            <Spline size={14} />
            Convert to freeform
          </button>
        )}

        {!compact && <ShapePresetGallery kind={shape.kind} onSelect={onChange} />}

        {shape.kind === 'rect' && (
          <HideScope name="rect">
            <>
              <NumberField
                label="Width"
                value={shape.width}
                min={10}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(width) => onChange({ ...shape, width })}
              />
              <NumberField
                label="Height"
                value={shape.height}
                min={10}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(height) => onChange({ ...shape, height })}
              />
              <NumberField
                label="Corner radius"
                value={shape.cornerRadius}
                min={0}
                max={Math.min(shape.width, shape.height) / 2}
                step={1}
                suffix="mm"
                onChange={(cornerRadius) => onChange({ ...shape, cornerRadius })}
              />
            </>
          </HideScope>
        )}

        {shape.kind === 'regularPolygon' && (
          <HideScope name="regularPolygon">
            <>
              <NumberField
                label="Sides"
                value={shape.sides}
                min={3}
                max={16}
                step={1}
                onChange={(sides) => onChange({ ...shape, sides })}
              />
              <NumberField
                label="Radius"
                value={shape.radius}
                min={5}
                max={radiusMax}
                step={5}
                suffix="mm"
                onChange={(radius) => onChange({ ...shape, radius })}
              />
              <NumberField
                label="Rotation"
                value={shape.rotation}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={(rotation) => onChange({ ...shape, rotation })}
              />
              <NumberField
                label="Corner radius"
                value={shape.cornerRadius}
                min={0}
                max={shape.radius / 2}
                step={1}
                suffix="mm"
                onChange={(cornerRadius) => onChange({ ...shape, cornerRadius })}
              />
            </>
          </HideScope>
        )}

        {shape.kind === 'superellipse' && (
          <HideScope name="superellipse">
            <>
              <NumberField
                label="Width"
                value={shape.width}
                min={10}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(width) => onChange({ ...shape, width })}
              />
              <NumberField
                label="Height"
                value={shape.height}
                min={10}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(height) => onChange({ ...shape, height })}
              />
              <NumberField
                label="Curvature"
                value={shape.exponent}
                min={0.5}
                max={10}
                step={0.1}
                onChange={(exponent) => onChange({ ...shape, exponent })}
              />
              {!compact && <p className="text-xs text-neutral-500">Low = diamond, 2 = ellipse, high = rounded rectangle.</p>}
            </>
          </HideScope>
        )}

        {shape.kind === 'star' && (
          <HideScope name="star">
            <>
              <NumberField
                label="Points"
                value={shape.points}
                min={3}
                max={16}
                step={1}
                onChange={(points) => onChange({ ...shape, points })}
              />
              <NumberField
                label="Outer radius"
                value={shape.radius}
                min={5}
                max={radiusMax}
                step={5}
                suffix="mm"
                onChange={(radius) => onChange({ ...shape, radius })}
              />
              <NumberField
                label="Inner radius ratio"
                value={shape.innerRadiusRatio}
                min={0.1}
                max={0.9}
                step={0.05}
                onChange={(innerRadiusRatio) => onChange({ ...shape, innerRadiusRatio })}
              />
              <NumberField
                label="Rotation"
                value={shape.rotation}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={(rotation) => onChange({ ...shape, rotation })}
              />
              <NumberField
                label="Point rounding"
                value={shape.cornerRadius}
                min={0}
                max={shape.radius * shape.innerRadiusRatio * 0.9}
                step={1}
                suffix="mm"
                onChange={(cornerRadius) => onChange({ ...shape, cornerRadius })}
              />
            </>
          </HideScope>
        )}

        {shape.kind === 'blob' && (
          <HideScope name="blob">
            <>
              <NumberField
                label="Radius"
                value={shape.radius}
                min={5}
                max={radiusMax}
                step={5}
                suffix="mm"
                onChange={(radius) => onChange({ ...shape, radius })}
              />
              <NumberField
                label="Complexity"
                value={shape.complexity}
                min={2}
                max={8}
                step={1}
                onChange={(complexity) => onChange({ ...shape, complexity })}
              />
              <NumberField
                label="Irregularity"
                value={shape.irregularity}
                min={0}
                max={0.9}
                step={0.05}
                onChange={(irregularity) => onChange({ ...shape, irregularity })}
              />
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <NumberField
                    label="Seed"
                    value={shape.seed}
                    min={0}
                    max={9999}
                    step={1}
                    slider={false}
                    onChange={(seed) => onChange({ ...shape, seed })}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onChange({ ...shape, seed: Math.floor(Math.random() * 10000) })}
                  className="mb-0.5 flex items-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
                  title="Randomize"
                >
                  <Shuffle size={14} />
                </button>
              </div>
            </>
          </HideScope>
        )}

        {shape.kind === 'teardrop' && (
          <HideScope name="teardrop">
            <>
              <NumberField
                label="Radius"
                value={shape.radius}
                min={5}
                max={radiusMax}
                step={5}
                suffix="mm"
                onChange={(radius) => onChange({ ...shape, radius })}
              />
              <NumberField
                label="Point sharpness"
                value={shape.pointSharpness}
                min={0.4}
                max={3}
                step={0.1}
                onChange={(pointSharpness) => onChange({ ...shape, pointSharpness })}
              />
              <NumberField
                label="Rotation"
                value={shape.rotation}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={(rotation) => onChange({ ...shape, rotation })}
              />
            </>
          </HideScope>
        )}

        {shape.kind === 'diamond' && (
          <HideScope name="diamond">
            <>
              <NumberField
                label="Width"
                value={shape.width}
                min={10}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(width) => onChange({ ...shape, width })}
              />
              <NumberField
                label="Height"
                value={shape.height}
                min={10}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(height) => onChange({ ...shape, height })}
              />
              <NumberField
                label="Corner radius"
                value={shape.cornerRadius}
                min={0}
                max={Math.min(shape.width, shape.height) / 2}
                step={1}
                suffix="mm"
                onChange={(cornerRadius) => onChange({ ...shape, cornerRadius })}
              />
            </>
          </HideScope>
        )}

        {shape.kind === 'eye' && (
          <HideScope name="eye">
            <>
              <NumberField
                label="Width"
                value={shape.width}
                min={20}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(width) => onChange({ ...shape, width })}
              />
              <NumberField
                label="Height"
                value={shape.height}
                min={5}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(height) => onChange({ ...shape, height })}
              />
              <NumberField
                label="Rotation"
                value={shape.rotation}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={(rotation) => onChange({ ...shape, rotation })}
              />
            </>
          </HideScope>
        )}

        {shape.kind === 'spiral' && (
          <HideScope name="spiral">
            <>
              <NumberField
                label="Turns"
                value={shape.turns}
                min={0.2}
                max={6}
                step={0.1}
                onChange={(turns) => onChange({ ...shape, turns })}
              />
              <NumberField
                label="Start radius"
                value={shape.startRadius}
                min={0}
                max={radiusMax}
                step={1}
                suffix="mm"
                onChange={(startRadius) => onChange({ ...shape, startRadius })}
              />
              <NumberField
                label="End radius"
                value={shape.endRadius}
                min={5}
                max={radiusMax}
                step={5}
                suffix="mm"
                onChange={(endRadius) => onChange({ ...shape, endRadius })}
              />
              <NumberField
                label="Stroke width"
                value={shape.strokeWidth}
                min={2}
                max={radiusMax / 2}
                step={1}
                suffix="mm"
                onChange={(strokeWidth) => onChange({ ...shape, strokeWidth })}
              />
              <NumberField
                label="Rotation"
                value={shape.rotation}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={(rotation) => onChange({ ...shape, rotation })}
              />
              {!compact && (
                <p className="text-xs text-neutral-500">
                  Low turns (≈0.3–0.6) reads as a swoosh/hook; higher turns (2+) reads as a swirl. The ribbon tapers to a
                  point automatically wherever it's wider than the local radius.
                </p>
              )}
            </>
          </HideScope>
        )}

        {shape.kind === 'vine' && (
          <HideScope name="vine">
            <>
              <NumberField
                label="Length"
                value={shape.length}
                min={20}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(length) => onChange({ ...shape, length })}
              />
              <NumberField
                label="Wave amplitude"
                value={shape.amplitude}
                min={0}
                max={sizeMax / 4}
                step={1}
                suffix="mm"
                onChange={(amplitude) => onChange({ ...shape, amplitude })}
              />
              <NumberField
                label="Wave count"
                value={shape.waveCount}
                min={0.5}
                max={8}
                step={0.5}
                onChange={(waveCount) => onChange({ ...shape, waveCount })}
              />
              <NumberField
                label="Stroke width"
                value={shape.strokeWidth}
                min={2}
                max={radiusMax / 2}
                step={1}
                suffix="mm"
                onChange={(strokeWidth) => onChange({ ...shape, strokeWidth })}
              />
              <NumberField
                label="Leaf bulge"
                value={shape.leafBulge}
                min={0}
                max={1}
                step={0.05}
                onChange={(leafBulge) => onChange({ ...shape, leafBulge })}
              />
              <NumberField
                label="Rotation"
                value={shape.rotation}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={(rotation) => onChange({ ...shape, rotation })}
              />
              {!compact && <p className="text-xs text-neutral-500">0 leaf bulge is a plain flowing ribbon.</p>}
            </>
          </HideScope>
        )}

        {shape.kind === 'leaf' && (
          <HideScope name="leaf">
            <>
              <NumberField
                label="Length"
                value={shape.length}
                min={20}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(length) => onChange({ ...shape, length })}
              />
              <NumberField
                label="Max width"
                value={shape.maxWidth}
                min={5}
                max={sizeMax / 2}
                step={5}
                suffix="mm"
                onChange={(maxWidth) => onChange({ ...shape, maxWidth })}
              />
              <NumberField
                label="Width position"
                value={shape.widthPosition}
                min={0.05}
                max={0.95}
                step={0.01}
                onChange={(widthPosition) => onChange({ ...shape, widthPosition })}
              />
              <NumberField
                label="Base taper"
                value={shape.baseTaper}
                min={0.4}
                max={3}
                step={0.1}
                onChange={(baseTaper) => onChange({ ...shape, baseTaper })}
              />
              <NumberField
                label="Tip taper"
                value={shape.tipTaper}
                min={0.4}
                max={3}
                step={0.1}
                onChange={(tipTaper) => onChange({ ...shape, tipTaper })}
              />
              <NumberField
                label="Curvature"
                value={shape.curvature}
                min={-90}
                max={90}
                step={1}
                suffix="°"
                onChange={(curvature) => onChange({ ...shape, curvature })}
              />
              <NumberField
                label="Rotation"
                value={shape.rotation}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={(rotation) => onChange({ ...shape, rotation })}
              />
              {!compact && (
                <p className="text-xs text-neutral-500">
                  Width position sets where along the spine the leaf is widest; taper controls how sharply each side
                  narrows back down. Curvature bends the spine into a gentle arc.
                </p>
              )}
            </>
          </HideScope>
        )}

        {shape.kind === 'freeform' && (
          <HideScope name="freeform">
            <>
              <p className="text-xs text-neutral-500">
                Drag a point directly on the canvas to reshape the curve there. Double-click a point to remove it;
                double-click on the outline between two points to add a new one there.
              </p>
              <div className="text-sm text-neutral-400">{shape.points.length} points</div>

              <FreeformMirrorLockControl points={shape.points} onChange={(points) => onChange({ kind: 'freeform', points })} />

              <p className="-mt-2 text-xs text-neutral-500">Or a one-time snapshot: keep one half, mirror it onto the other.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ kind: 'freeform', points: mirrorFreeformPoints(shape.points, 'vertical') })}
                  title="Keep the left half, mirror it onto the right"
                  className="flex-1 rounded-md border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
                >
                  Mirror ↔
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ kind: 'freeform', points: mirrorFreeformPoints(shape.points, 'horizontal') })}
                  title="Keep the top half, mirror it onto the bottom"
                  className="flex-1 rounded-md border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
                >
                  Mirror ↕
                </button>
              </div>
              <button
                type="button"
                onClick={() => onChange({ kind: 'freeform', points: defaultFreeformPoints() })}
                className="flex items-center justify-center gap-1.5 rounded-md border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
              >
                Reset to circle
              </button>
            </>
          </HideScope>
        )}

        {shape.kind === 'feather' && (
          <HideScope name="feather">
            <>
              <NumberField
                label="Length"
                value={shape.length}
                min={40}
                max={sizeMax}
                step={5}
                suffix="mm"
                onChange={(length) => onChange({ ...shape, length })}
              />
              <NumberField
                label="Spine width"
                value={shape.spineWidth}
                min={2}
                max={radiusMax / 4}
                step={1}
                suffix="mm"
                onChange={(spineWidth) => onChange({ ...shape, spineWidth })}
              />
              <NumberField
                label="Barb count"
                value={shape.barbCount}
                min={2}
                max={40}
                step={1}
                onChange={(barbCount) => onChange({ ...shape, barbCount })}
              />
              <NumberField
                label="Barb length"
                value={shape.barbLength}
                min={5}
                max={radiusMax / 2}
                step={1}
                suffix="mm"
                onChange={(barbLength) => onChange({ ...shape, barbLength })}
              />
              <NumberField
                label="Barb width"
                value={shape.barbWidth}
                min={1}
                max={radiusMax / 4}
                step={0.5}
                suffix="mm"
                onChange={(barbWidth) => onChange({ ...shape, barbWidth })}
              />
              <NumberField
                label="Barb sweep"
                value={shape.barbSweep}
                min={-80}
                max={80}
                step={1}
                suffix="°"
                onChange={(barbSweep) => onChange({ ...shape, barbSweep })}
              />
              <NumberField
                label="Rotation"
                value={shape.rotation}
                min={0}
                max={360}
                step={1}
                suffix="°"
                onChange={(rotation) => onChange({ ...shape, rotation })}
              />
              {!compact && (
                <p className="text-xs text-neutral-500">
                  Built by fusing a tapered spine with swept barb spikes into one outline — a compound shape, not a
                  single formula.
                </p>
              )}
            </>
          </HideScope>
        )}
      </>
    </HideScope>
  )
}

/** While set to horizontal or vertical, dragging any anchor or handle on
 * the canvas updates its mirror partner live — an editor-session
 * preference (lives in the store, not the shape data), so the lock flag
 * itself is read/set from here but actually applied in
 * FreeformShapeEditor, which is mounted in the canvas tree, not this
 * panel. FreeformShapeEditor pairs point `i` with `n-1-i`, which is only a
 * true mirror partner once the points are arranged in the "kept half,
 * then its reflection reversed" order `mirrorFreeformPoints` produces —
 * an arbitrary point list (e.g. fresh from Convert to freeform) isn't in
 * that order, so turning the lock on runs that same one-shot snapshot
 * first to establish it, then every live drag after stays consistent. */
function FreeformMirrorLockControl({
  points,
  onChange,
}: {
  points: FreeformPoint[]
  onChange: (points: FreeformPoint[]) => void
}) {
  const lock = useDesignerStore((s) => s.freeformMirrorLock)
  const setLock = useDesignerStore((s) => s.setFreeformMirrorLock)

  const applyLock = (next: typeof lock) => {
    if (next !== 'off') onChange(mirrorFreeformPoints(points, next))
    setLock(next)
  }

  return (
    <>
      <SegmentedControl
        hideKey="Live mirror"
        value={lock}
        options={[
          { value: 'off', label: 'Off' },
          { value: 'vertical', label: 'Live ↔' },
          { value: 'horizontal', label: 'Live ↕' },
        ]}
        onChange={applyLock}
      />
      {lock !== 'off' && (
        <p className="-mt-2 text-xs text-neutral-500">
          Latched — drag any point on the canvas and its mirror partner updates in real time.
        </p>
      )}
    </>
  )
}
