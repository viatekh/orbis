import { AlertTriangle } from 'lucide-react'
import type { GeometryResult } from '../../lib/geometry/types'

export function CanvasOverlay({ geometry }: { geometry: GeometryResult }) {
  const { bounds, stats, warnings } = geometry
  const widthMm = Math.round(bounds.maxX - bounds.minX)
  const heightMm = Math.round(bounds.maxY - bounds.minY)

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      <div className="flex flex-wrap gap-2">
        {warnings.map((w) => (
          <div
            key={w.code}
            className="pointer-events-auto flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-1 text-xs text-amber-300 ring-1 ring-amber-500/30"
          >
            <AlertTriangle size={13} />
            {w.message}
          </div>
        ))}
      </div>
      <div className="self-end rounded-md bg-black/50 px-2 py-1 text-xs text-neutral-300 backdrop-blur-sm">
        {widthMm} × {heightMm} mm · {stats.leafCells} cells
        {stats.maxLevelReached > 0 ? ` · ${stats.maxLevelReached + 1} levels` : ''} ·{' '}
        {stats.computeMs.toFixed(1)} ms
      </div>
    </div>
  )
}
