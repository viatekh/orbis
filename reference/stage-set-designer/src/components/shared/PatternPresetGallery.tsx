import { PATTERN_PRESETS, type PatternPreset } from '../../lib/geometry/patternPresets'

/** A flat, named library of tuned pattern configurations — the pattern
 * panel's equivalent of the shape panel's preset gallery. Text-only chips
 * rather than live thumbnails: computing real geometry for ~50 presets on
 * every panel render would be far more expensive than the shape gallery's
 * cheap outline-only thumbnails.
 *
 * Generic over the pattern type via `apply`, so both the main pattern
 * panel (PatternConfig) and the surface-detail panel
 * (SurfaceDetailPatternConfig — a strict subset) can share this same
 * gallery instead of the detail panel being stuck with a hand-rolled
 * subset of options. */
export function PatternPresetGallery<T>({
  pattern,
  apply,
  onSelect,
}: {
  pattern: T
  apply: (current: T, preset: PatternPreset) => T
  onSelect: (pattern: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-neutral-500">Named styles — click to try</p>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {PATTERN_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onSelect(apply(pattern, preset))}
            title={`${preset.label} (${preset.kind})`}
            className="rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:border-purple-500 hover:bg-neutral-800 hover:text-white"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}
