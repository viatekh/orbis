import { useMemo } from 'react'
import { Download, Trash2 } from 'lucide-react'
import { useUiSettingsStore } from '../../store/uiSettingsStore'
import { useRatingsStore } from '../../store/ratingsStore'
import { summarizeNumeric, summarizeCategorical } from '../../lib/insights'
import { downloadJSON } from '../../lib/utils'
import { CollapsibleSection } from '../shared/CollapsibleSection'

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** Debug-mode-only view over everything saved by RatingPanel: for each
 * numeric control, the observed min/max/average split by 'good' vs 'ok'
 * ratings, and for each enum/boolean control, how often each option shows
 * up among 'good' designs. Meant to be read by a person (or fed back to
 * Claude via the JSON export) to decide things like "this range is never
 * used above 60%, narrow the slider" or "add a dedicated preset for this
 * kind combo" — this panel surfaces the data but doesn't try to generate
 * those suggestions itself. */
export function InsightsPanel() {
  const debugMode = useUiSettingsStore((s) => s.debugMode)
  const entries = useRatingsStore((s) => s.entries)
  const clearRatings = useRatingsStore((s) => s.clearRatings)

  const goodEntries = useMemo(() => entries.filter((e) => e.rating === 'good'), [entries])
  const okEntries = useMemo(() => entries.filter((e) => e.rating === 'ok'), [entries])

  const numericRows = useMemo(() => {
    const good = new Map(summarizeNumeric(goodEntries).map((s) => [s.path, s]))
    const ok = new Map(summarizeNumeric(okEntries).map((s) => [s.path, s]))
    const paths = new Set([...good.keys(), ...ok.keys()])
    return [...paths].sort().map((path) => ({ path, good: good.get(path), ok: ok.get(path) }))
  }, [goodEntries, okEntries])

  const kindCounts = useMemo(() => {
    const stats = summarizeCategorical(goodEntries)
    return stats.find((s) => s.path === 'pattern.kind')?.counts ?? {}
  }, [goodEntries])

  if (!debugMode) return null

  const handleExport = () => downloadJSON({ exportedAt: new Date().toISOString(), entries }, 'design-ratings.json')
  const handleClear = () => {
    if (entries.length === 0) return
    if (confirm(`Delete all ${entries.length} saved ratings? This can't be undone.`)) clearRatings()
  }

  return (
    <CollapsibleSection id="insights" title={`Insights (${goodEntries.length} good · ${okEntries.length} ok)`}>
      {entries.length === 0 ? (
        <p className="text-xs text-neutral-500">Rate some designs above to start building this up.</p>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-neutral-700 px-2 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
            >
              <Download size={12} />
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center justify-center gap-1.5 rounded-md border border-red-900 px-2 py-1.5 text-xs text-red-400 hover:bg-red-950"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>

          {Object.keys(kindCounts).length > 0 && (
            <div>
              <h5 className="mb-1 text-xs font-medium text-neutral-400">Pattern kinds among 'good'</h5>
              <p className="text-xs text-neutral-300">
                {Object.entries(kindCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([kind, count]) => `${kind} ×${count}`)
                  .join(', ')}
              </p>
            </div>
          )}

          <div>
            <h5 className="mb-1 text-xs font-medium text-neutral-400">Param ranges (min–max, avg)</h5>
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded border border-neutral-800 p-1.5">
              {numericRows.map((row) => (
                <div key={row.path} className="border-b border-neutral-800 pb-1.5 text-[11px] last:border-0 last:pb-0">
                  <p className="truncate text-neutral-400" title={row.path}>
                    {row.path}
                  </p>
                  <p className="tabular-nums text-emerald-400">
                    good: {row.good ? `${fmt(row.good.min)}–${fmt(row.good.max)} (${fmt(row.good.mean)})` : '—'}
                  </p>
                  <p className="tabular-nums text-neutral-500">
                    ok: {row.ok ? `${fmt(row.ok.min)}–${fmt(row.ok.max)} (${fmt(row.ok.mean)})` : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </CollapsibleSection>
  )
}
