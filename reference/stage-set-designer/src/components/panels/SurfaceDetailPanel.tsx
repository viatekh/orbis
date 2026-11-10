import { useMemo } from 'react'
import { Shuffle } from 'lucide-react'
import { NumberField } from '../shared/NumberField'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Checkbox } from '../shared/Checkbox'
import { HideScope } from '../shared/HideScope'
import { ShapeFields } from '../shared/ShapeFields'
import { PatternKindPicker } from '../shared/PatternKindPicker'
import { PatternPresetGallery } from '../shared/PatternPresetGallery'
import { randomizeSurfaceDetailPattern } from '../shared/randomize'
import { RadialEffectsPanel } from './RadialEffectsPanel'
import { DispersionPanel } from './DispersionPanel'
import { useDesignerStore } from '../../store/designerStore'
import { applyPatternPresetToSurfaceDetail } from '../../lib/geometry/patternPresets'
import { estimateCellCount } from '../../lib/geometry/estimateCellCount'
import type { StageComponent, SurfaceDetailConfig, SurfaceDetailPatternConfig } from '../../types'

/** A second, independent pattern — always etch-only — generated across the
 * same outline as the main pattern above it. Meant for fine decorative
 * detail (e.g. PCB-trace-like engraving) layered on top of a coarser
 * structural cut lattice, rather than another structural layer itself.
 *
 * Mirrors the main PatternPanel's controls field-for-field (same kind
 * picker, same preset gallery, same fractal recursion / radial effects
 * sections) minus only what genuinely doesn't apply to a detail layer:
 * cut/etch mode (always etch), null shape + explode (that's a concern of
 * the outer structural pattern), and "keep all recursion levels" (a
 * cut-mode-only option). */
export function SurfaceDetailPanel({ component }: { component: StageComponent }) {
  const updatePattern = useDesignerStore((s) => s.updatePattern)
  const detail = component.pattern.surfaceDetail
  const dp = detail.pattern

  const setDetail = (patch: Partial<SurfaceDetailConfig>) =>
    updatePattern(component.id, { surfaceDetail: { ...detail, ...patch } })
  const setDetailPattern = (patch: Partial<SurfaceDetailPatternConfig>) =>
    updatePattern(component.id, { surfaceDetail: { ...detail, pattern: { ...dp, ...patch } } })
  const setDetailRecursion = (patch: Partial<SurfaceDetailPatternConfig['recursion']>) =>
    setDetailPattern({ recursion: { ...dp.recursion, ...patch } })
  const setDetailStamp = (patch: Partial<SurfaceDetailPatternConfig['stamp']>) =>
    setDetailPattern({ stamp: { ...dp.stamp, ...patch } })

  const estimate = useMemo(() => estimateCellCount(component.shape, dp), [component.shape, dp])
  const overBudget = estimate > dp.recursion.maxLeafCells

  return (
    <HideScope name="surfaceDetail">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Checkbox
            label="Surface detail"
            className="font-medium text-neutral-200"
            checked={detail.enabled}
            onChange={(enabled) => setDetail({ enabled })}
          />
          {detail.enabled && (
            <button
              type="button"
              onClick={() => setDetailPattern(randomizeSurfaceDetailPattern(dp))}
              className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
              title="Randomize surface detail parameters"
            >
              <Shuffle size={12} />
              Randomize
            </button>
          )}
        </div>
        <p className="-mt-2 text-xs text-neutral-500">
          A second, finer pattern etched across the same outline, independent of the cut structure above — for
          decorative surface engraving rather than another structural layer. Works with Null shape too: each fragment
          stays registered to its own piece and travels with it as Explode amount pushes it outward.
        </p>

        {detail.enabled && (
          <>
            <PatternKindPicker value={dp.kind} onChange={(kind) => setDetailPattern({ kind })} />

            <PatternPresetGallery pattern={dp} apply={applyPatternPresetToSurfaceDetail} onSelect={setDetailPattern} />

            {dp.kind === 'hexagon' && (
              <SegmentedControl
                hideKey="Hex orientation"
                value={dp.hexOrientation}
                options={[
                  { value: 'flat', label: 'Flat-top' },
                  { value: 'pointy', label: 'Pointy-top' },
                ]}
                onChange={(hexOrientation) => setDetailPattern({ hexOrientation })}
              />
            )}

            <NumberField
              label="Cell size"
              value={dp.cellSize}
              min={2}
              max={60}
              step={0.5}
              suffix="mm"
              onChange={(cellSize) => setDetailPattern({ cellSize })}
            />

            <NumberField
              label="Symmetry copies"
              value={dp.symmetryCount}
              min={1}
              max={24}
              step={1}
              onChange={(symmetryCount) => setDetailPattern({ symmetryCount })}
            />
            {dp.symmetryCount > 1 && (
              <p className="-mt-2 text-xs text-neutral-500">
                Generates one 1/{dp.symmetryCount} wedge and repeats it with true rotational symmetry.
              </p>
            )}

            <Checkbox
              label="Mirror symmetry"
              className="text-neutral-300"
              checked={dp.mirrorSymmetry}
              onChange={(mirrorSymmetry) => setDetailPattern({ mirrorSymmetry })}
            />
            {dp.mirrorSymmetry && dp.symmetryCount > 1 && (
              <p className="-mt-2 text-xs text-neutral-500">
                Each wedge becomes a mirror image of itself (dihedral/kaleidoscope symmetry) instead of just a spun
                copy.
              </p>
            )}
            {dp.mirrorSymmetry && dp.symmetryCount <= 1 && (
              <>
                <p className="-mt-2 text-xs text-neutral-500">
                  Bilateral reflection — no rotational copies. Pick either axis, or both for 4-fold/quadrant symmetry.
                </p>
                <Checkbox
                  label="Horizontal ↕"
                  className="text-neutral-300"
                  checked={dp.mirrorHorizontal}
                  onChange={(mirrorHorizontal) => setDetailPattern({ mirrorHorizontal })}
                />
                <Checkbox
                  label="Vertical ↔"
                  className="text-neutral-300"
                  checked={dp.mirrorVertical}
                  onChange={(mirrorVertical) => setDetailPattern({ mirrorVertical })}
                />
              </>
            )}

            {dp.kind !== 'stamp' && (
              <>
                <NumberField
                  label={dp.kind === 'voronoi' ? 'Jitter' : 'Randomness'}
                  value={dp.jitter}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(jitter) => setDetailPattern({ jitter })}
                />
                <NumberField
                  label="Seed"
                  value={dp.seed}
                  min={0}
                  max={9999}
                  step={1}
                  onChange={(seed) => setDetailPattern({ seed })}
                />
              </>
            )}

            {dp.kind === 'stamp' && (
              <>
                <NumberField
                  label="Ring spacing"
                  value={dp.stamp.ringSpacing}
                  min={0}
                  max={100}
                  step={0.5}
                  suffix="mm"
                  onChange={(ringSpacing) => setDetailStamp({ ringSpacing })}
                />
                <p className="-mt-2 text-xs text-neutral-500">0 uses the cell size above.</p>

                <Checkbox
                  label="Orient motifs to face outward"
                  className="text-neutral-300"
                  checked={dp.stamp.autoOrient}
                  onChange={(autoOrient) => setDetailStamp({ autoOrient })}
                />

                <NumberField
                  label="Ring stagger"
                  value={dp.stamp.ringStagger}
                  min={0}
                  max={180}
                  step={1}
                  suffix="°"
                  onChange={(ringStagger) => setDetailStamp({ ringStagger })}
                />

                <div className="h-px bg-neutral-800" />
                <h4 className="text-sm font-medium text-neutral-200">Motif shape</h4>
                <ShapeFields shape={dp.stamp.shape} onChange={(shape) => setDetailStamp({ shape })} compact />
              </>
            )}

            <NumberField
              label="Line spacing"
              value={dp.strutWidth}
              min={dp.minStrutWidth}
              max={10}
              step={0.25}
              suffix="mm"
              onChange={(strutWidth) => setDetailPattern({ strutWidth })}
            />

            <NumberField
              label="Edge margin"
              value={dp.edgeMargin}
              min={0}
              max={100}
              step={1}
              suffix="mm"
              onChange={(edgeMargin) => setDetailPattern({ edgeMargin })}
            />

            <div className="h-px bg-neutral-800" />

            <h4 className="text-sm font-medium text-neutral-200">Fractal recursion</h4>

            <NumberField
              label="Depth"
              value={dp.recursion.depth}
              min={0}
              max={3}
              step={1}
              onChange={(depth) => setDetailRecursion({ depth })}
            />

            {dp.recursion.depth > 0 && (
              <>
                <NumberField
                  label="Child scale"
                  value={dp.recursion.childScale}
                  min={0.2}
                  max={0.6}
                  step={0.05}
                  onChange={(childScale) => setDetailRecursion({ childScale })}
                />
                <NumberField
                  label="Strut falloff"
                  value={dp.recursion.strutFalloff}
                  min={0.3}
                  max={1}
                  step={0.05}
                  onChange={(strutFalloff) => setDetailRecursion({ strutFalloff })}
                />
              </>
            )}

            <div className={overBudget ? 'text-xs text-amber-400' : 'text-xs text-neutral-500'}>
              ≈ {estimate.toLocaleString()} cells estimated
              {overBudget ? ` — exceeds budget of ${dp.recursion.maxLeafCells.toLocaleString()}` : ''}
            </div>

            <div className="h-px bg-neutral-800" />

            <RadialEffectsPanel
              modulation={dp.radialModulation}
              onChange={(patch) => setDetailPattern({ radialModulation: { ...dp.radialModulation, ...patch } })}
            />

            <div className="h-px bg-neutral-800" />

            <DispersionPanel
              dispersion={dp.dispersion}
              onChange={(patch) => setDetailPattern({ dispersion: { ...dp.dispersion, ...patch } })}
            />
          </>
        )}
      </div>
    </HideScope>
  )
}
