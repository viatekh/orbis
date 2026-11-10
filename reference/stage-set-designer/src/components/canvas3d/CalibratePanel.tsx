import { useState } from 'react'
import { Ruler, X } from 'lucide-react'
import * as THREE from 'three'
import { cn } from '../../lib/utils'

/** The DOM overlay for "calibrate scale by picking two points" — sits over
 * the 3D canvas (not inside it; see Arrangement3DView) alongside the
 * view-mode switcher DesignerPage already overlays the same way. Purely
 * presentational: `pointA`/`pointB` are owned by Arrangement3DView (which
 * also needs them to render the marker spheres/line in the 3D scene), this
 * just reads them to show the measured distance and collect the target. */
export function CalibratePanel({
  calibrating,
  onToggle,
  pointA,
  pointB,
  onApply,
  onCancel,
}: {
  calibrating: boolean
  onToggle: () => void
  pointA: THREE.Vector3 | null
  pointB: THREE.Vector3 | null
  onApply: (desiredMm: number) => void
  onCancel: () => void
}) {
  const [desiredMm, setDesiredMm] = useState('')

  const measuredMm = pointA && pointB ? pointA.distanceTo(pointB) : null
  const desired = Number(desiredMm)
  const canApply = measuredMm !== null && measuredMm > 0 && Number.isFinite(desired) && desired > 0

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10">
      <div className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-neutral-700 bg-neutral-900/95 p-3 text-sm">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors',
            calibrating
              ? 'border-amber-500 bg-amber-500/10 text-amber-300'
              : 'border-neutral-700 text-neutral-400 hover:bg-neutral-800',
          )}
        >
          <Ruler size={12} />
          Calibrate scale {calibrating ? '(on)' : ''}
        </button>

        {calibrating && (
          <>
            <p className="max-w-56 text-xs text-neutral-500">
              Click two points on the model. Scales the whole arrangement — every component it uses (including
              anywhere else those are reused) and its radial/grid/manual layout.
            </p>

            {!pointA && <p className="text-xs text-neutral-400">Click the first point…</p>}
            {pointA && !pointB && <p className="text-xs text-neutral-400">Click the second point…</p>}

            {measuredMm !== null && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-neutral-400">
                  Measured: <span className="text-neutral-200">{measuredMm.toFixed(1)}mm</span>
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={desiredMm}
                    onChange={(e) => setDesiredMm(e.target.value)}
                    placeholder="Target mm"
                    className="w-24 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-right text-sm outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    disabled={!canApply}
                    onClick={() => canApply && onApply(desired)}
                    className="flex-1 rounded-md bg-purple-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-400 disabled:opacity-40"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                    title="Reset points"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
