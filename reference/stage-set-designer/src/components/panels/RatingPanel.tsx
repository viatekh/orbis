import { ThumbsUp, Smile } from 'lucide-react'
import { useUiSettingsStore } from '../../store/uiSettingsStore'
import { useRatingsStore } from '../../store/ratingsStore'
import type { StageComponent } from '../../types'
import type { GeometryResult } from '../../lib/geometry/types'

/** Only shown in debug mode — see DesignerPage's Debug mode toggle. Lets you
 * mark the component currently on screen as 'good' or 'ok', snapshotting
 * its full shape/pattern/centerHole params (plus a few geometry stats) into
 * the ratings store. The idea: rate enough designs across enough
 * randomize/tweak sessions, then use InsightsPanel (or export the raw data)
 * to see which parameter values/ranges and pattern kinds actually show up
 * in what you liked — informing later decisions about which controls to
 * add, remove, or rescale. Deliberately doesn't try to compute those
 * suggestions automatically here; see insights.ts. */
export function RatingPanel({ component, geometry }: { component: StageComponent; geometry: GeometryResult | null }) {
  const debugMode = useUiSettingsStore((s) => s.debugMode)
  const entries = useRatingsStore((s) => s.entries)
  const addRating = useRatingsStore((s) => s.addRating)

  if (!debugMode) return null

  const goodCount = entries.filter((e) => e.rating === 'good').length
  const okCount = entries.filter((e) => e.rating === 'ok').length

  const rate = (rating: 'good' | 'ok') => {
    addRating({
      rating,
      componentName: component.name,
      shape: component.shape,
      pattern: component.pattern,
      centerHole: component.centerHole,
      stats: geometry
        ? {
            leafCells: geometry.stats.leafCells,
            totalCells: geometry.stats.totalCells,
            cutAreaMm2: geometry.stats.cutAreaMm2,
            materialAreaMm2: geometry.stats.materialAreaMm2,
          }
        : { leafCells: 0, totalCells: 0, cutAreaMm2: 0, materialAreaMm2: 0 },
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-xs text-amber-300/80">Rate this design — saved params feed the Insights panel below</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => rate('good')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          <ThumbsUp size={14} />
          Good ({goodCount})
        </button>
        <button
          type="button"
          onClick={() => rate('ok')}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-neutral-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-600"
        >
          <Smile size={14} />
          OK ({okCount})
        </button>
      </div>
    </div>
  )
}
