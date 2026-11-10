import { useMemo } from 'react'
import { Shuffle } from 'lucide-react'
import { NumberField } from '../shared/NumberField'
import { SegmentedControl } from '../shared/SegmentedControl'
import { Checkbox } from '../shared/Checkbox'
import { HideScope } from '../shared/HideScope'
import { CollapsibleSection } from '../shared/CollapsibleSection'
import { ShapeFields } from '../shared/ShapeFields'
import { PatternKindPicker } from '../shared/PatternKindPicker'
import { PatternPresetGallery } from '../shared/PatternPresetGallery'
import { EdgeDetailFields } from '../shared/EdgeDetailFields'
import { randomizePattern } from '../shared/randomize'
import { RadialEffectsPanel } from './RadialEffectsPanel'
import { DispersionPanel } from './DispersionPanel'
import { SurfaceDetailPanel } from './SurfaceDetailPanel'
import { useDesignerStore } from '../../store/designerStore'
import { applyPatternPreset } from '../../lib/geometry/patternPresets'
import { estimateCellCount } from '../../lib/geometry/estimateCellCount'
import type { PatternConfig, StageComponent } from '../../types'

export function PatternPanel({ component }: { component: StageComponent }) {
  const updatePattern = useDesignerStore((s) => s.updatePattern)
  const pattern = component.pattern

  const set = (patch: Partial<PatternConfig>) => updatePattern(component.id, patch)
  const setRecursion = (patch: Partial<PatternConfig['recursion']>) =>
    updatePattern(component.id, { recursion: { ...pattern.recursion, ...patch } })
  const setStamp = (patch: Partial<PatternConfig['stamp']>) =>
    updatePattern(component.id, { stamp: { ...pattern.stamp, ...patch } })

  // Re-tessellates the shape outline to estimate cell count, which is
  // wasted work on every keystroke if it's not the shape/pattern fields
  // that actually changed (e.g. while a sibling panel re-renders this one).
  const estimate = useMemo(() => estimateCellCount(component.shape, pattern), [component.shape, pattern])
  const overBudget = estimate > pattern.recursion.maxLeafCells

  return (
    <HideScope name="pattern">
      <CollapsibleSection
        id="pattern"
        title="Pattern"
        headerRight={
          <button
            type="button"
            onClick={() => updatePattern(component.id, randomizePattern(pattern))}
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
            title="Randomize pattern parameters"
          >
            <Shuffle size={12} />
            Randomize
          </button>
        }
      >
        <PatternKindPicker value={pattern.kind} onChange={(kind) => set({ kind })} />

        <PatternPresetGallery
          pattern={pattern}
          apply={applyPatternPreset}
          onSelect={(next) => updatePattern(component.id, next)}
        />

        {!pattern.nullShape && (
          <SegmentedControl
            hideKey="Mode"
            value={pattern.mode}
            options={[
              { value: 'cut', label: 'Cut lattice' },
              { value: 'etch', label: 'Surface etch' },
            ]}
            onChange={(mode) => set({ mode })}
          />
        )}

        {pattern.kind === 'hexagon' && (
          <SegmentedControl
            hideKey="Hex orientation"
            value={pattern.hexOrientation}
            options={[
              { value: 'flat', label: 'Flat-top' },
              { value: 'pointy', label: 'Pointy-top' },
            ]}
            onChange={(hexOrientation) => set({ hexOrientation })}
          />
        )}

        <NumberField
          label="Cell size"
          value={pattern.cellSize}
          min={5}
          max={200}
          step={1}
          suffix="mm"
          onChange={(cellSize) => set({ cellSize })}
        />

        <NumberField
          label="Symmetry copies"
          value={pattern.symmetryCount}
          min={1}
          max={24}
          step={1}
          onChange={(symmetryCount) => set({ symmetryCount })}
        />
        {pattern.symmetryCount > 1 && (
          <p className="-mt-2 text-xs text-neutral-500">
            Generates one 1/{pattern.symmetryCount} wedge and repeats it with true rotational symmetry — e.g. 6 for a
            hexagon, 12 for a finer mandala.
          </p>
        )}

        <Checkbox
          label="Mirror symmetry"
          className="text-neutral-300"
          checked={pattern.mirrorSymmetry}
          onChange={(mirrorSymmetry) => set({ mirrorSymmetry })}
        />
        {pattern.mirrorSymmetry && pattern.symmetryCount > 1 && (
          <p className="-mt-2 text-xs text-neutral-500">
            Each wedge becomes a mirror image of itself (dihedral/kaleidoscope symmetry) instead of just a spun copy —
            the classic mandala look.
          </p>
        )}
        {pattern.mirrorSymmetry && pattern.symmetryCount <= 1 && (
          <>
            <p className="-mt-2 text-xs text-neutral-500">
              Bilateral reflection — no rotational copies. Pick either axis, or both together for 4-fold/quadrant
              symmetry.
            </p>
            <Checkbox
              label="Horizontal ↕"
              className="text-neutral-300"
              checked={pattern.mirrorHorizontal}
              onChange={(mirrorHorizontal) => set({ mirrorHorizontal })}
            />
            <Checkbox
              label="Vertical ↔"
              className="text-neutral-300"
              checked={pattern.mirrorVertical}
              onChange={(mirrorVertical) => set({ mirrorVertical })}
            />
          </>
        )}

        <div className="h-px bg-neutral-800" />

        <Checkbox
          label="Null shape"
          className="font-medium text-neutral-200"
          checked={pattern.nullShape}
          onChange={(nullShape) => set({ nullShape })}
        />
        <p className="-mt-2 text-xs text-neutral-500">
          The designed shape stops being a border to cut — it's only used to decide which cells exist. The export
          becomes the cells themselves: an organic silhouette that hugs the pattern, with no panel and no internal
          cutouts.
        </p>

        {pattern.nullShape && (
          <NumberField
            label="Explode amount"
            value={pattern.explodeAmount}
            min={0}
            max={200}
            step={1}
            suffix="mm"
            onChange={(explodeAmount) => set({ explodeAmount })}
          />
        )}

        {pattern.kind !== 'stamp' && (
          <>
            <NumberField
              label={pattern.kind === 'voronoi' ? 'Jitter' : 'Randomness'}
              value={pattern.jitter}
              min={0}
              max={1}
              step={0.05}
              onChange={(jitter) => set({ jitter })}
            />
            <NumberField label="Seed" value={pattern.seed} min={0} max={9999} step={1} onChange={(seed) => set({ seed })} />
          </>
        )}

        {pattern.kind === 'stamp' && (
          <>
            <NumberField
              label="Ring spacing"
              value={pattern.stamp.ringSpacing}
              min={0}
              max={200}
              step={1}
              suffix="mm"
              onChange={(ringSpacing) => setStamp({ ringSpacing })}
            />
            <p className="-mt-2 text-xs text-neutral-500">0 uses the cell size above.</p>

            <Checkbox
              label="Orient motifs to face outward"
              className="text-neutral-300"
              checked={pattern.stamp.autoOrient}
              onChange={(autoOrient) => setStamp({ autoOrient })}
            />

            <NumberField
              label="Ring stagger"
              value={pattern.stamp.ringStagger}
              min={0}
              max={180}
              step={1}
              suffix="°"
              onChange={(ringStagger) => setStamp({ ringStagger })}
            />

            <div className="h-px bg-neutral-800" />
            <h4 className="text-sm font-medium text-neutral-200">Motif shape</h4>
            <ShapeFields shape={pattern.stamp.shape} onChange={(shape) => setStamp({ shape })} compact />
          </>
        )}

        <NumberField
          label="Strut width"
          value={pattern.strutWidth}
          min={pattern.minStrutWidth}
          max={30}
          step={0.5}
          suffix="mm"
          onChange={(strutWidth) => set({ strutWidth })}
        />

        <NumberField
          label="Edge margin"
          value={pattern.edgeMargin}
          min={0}
          max={100}
          step={1}
          suffix="mm"
          onChange={(edgeMargin) => set({ edgeMargin })}
        />

        <div className="h-px bg-neutral-800" />

        <CollapsibleSection id="pattern.recursion" title="Fractal recursion" compact>
          <NumberField
            label="Depth"
            value={pattern.recursion.depth}
            min={0}
            max={3}
            step={1}
            onChange={(depth) => setRecursion({ depth })}
          />

          {pattern.recursion.depth > 0 && (
            <>
              <NumberField
                label="Child scale"
                value={pattern.recursion.childScale}
                min={0.2}
                max={0.6}
                step={0.05}
                onChange={(childScale) => setRecursion({ childScale })}
              />
              <NumberField
                label="Strut falloff"
                value={pattern.recursion.strutFalloff}
                min={0.3}
                max={1}
                step={0.05}
                onChange={(strutFalloff) => setRecursion({ strutFalloff })}
              />
            </>
          )}
        </CollapsibleSection>

        <div className={overBudget ? 'text-xs text-amber-400' : 'text-xs text-neutral-500'}>
          ≈ {estimate.toLocaleString()} cells estimated
          {overBudget ? ` — exceeds budget of ${pattern.recursion.maxLeafCells.toLocaleString()}` : ''}
        </div>

        {!pattern.nullShape && (
          <>
            <div className="h-px bg-neutral-800" />

            <Checkbox
              label={
                <>
                  Keep all recursion levels as cut lines <span className="text-neutral-500">(redundant double-cuts — advanced)</span>
                </>
              }
              hideLabel="Keep all recursion levels as cut lines"
              className="text-neutral-300"
              checked={pattern.mode === 'cut' && pattern.keepAllLevelsInCut}
              disabled={pattern.mode !== 'cut' || pattern.recursion.depth === 0}
              onChange={(keepAllLevelsInCut) => set({ keepAllLevelsInCut })}
            />
          </>
        )}

        <div className="h-px bg-neutral-800" />

        <RadialEffectsPanel
          modulation={pattern.radialModulation}
          onChange={(patch) => set({ radialModulation: { ...pattern.radialModulation, ...patch } })}
        />

        <div className="h-px bg-neutral-800" />
        <DispersionPanel
          dispersion={pattern.dispersion}
          onChange={(patch) => set({ dispersion: { ...pattern.dispersion, ...patch } })}
        />

        <div className="h-px bg-neutral-800" />
        <SurfaceDetailPanel component={component} />

        {!pattern.nullShape && (
          <>
            <div className="h-px bg-neutral-800" />
            <HideScope name="edgeDetail">
              <div className="flex flex-col gap-4">
                <Checkbox
                  label="Edge detail"
                  className="font-medium text-neutral-200"
                  checked={pattern.edgeDetail.enabled}
                  onChange={(enabled) => set({ edgeDetail: { ...pattern.edgeDetail, enabled } })}
                />
                <p className="-mt-2 text-xs text-neutral-500">
                  A decorative motif banded around the component's own outer edge — independent of the main lattice.
                </p>
                {pattern.edgeDetail.enabled && (
                  <EdgeDetailFields
                    config={pattern.edgeDetail}
                    onChange={(patch) => set({ edgeDetail: { ...pattern.edgeDetail, ...patch } })}
                  />
                )}
              </div>
            </HideScope>
          </>
        )}
      </CollapsibleSection>
    </HideScope>
  )
}
