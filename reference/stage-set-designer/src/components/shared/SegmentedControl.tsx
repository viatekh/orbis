import { cn } from '../../lib/utils'
import { HideToggleButton } from './HideToggleButton'
import { useHideable } from './useHideable'

interface Option<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  /** Opts this control into the debug-mode hide system, under this key —
   * omit for controls that should always stay visible (e.g. primary page
   * navigation), since without a key there's nothing to hide by. */
  hideKey?: string
}

export function SegmentedControl<T extends string>({ value, options, onChange, hideKey }: SegmentedControlProps<T>) {
  const hideable = useHideable(hideKey ?? '')
  if (hideKey && hideable.hidden && !hideable.debugMode) return null

  return (
    <div className={cn('flex items-center gap-1.5', hideKey && hideable.hidden && 'opacity-40')}>
      {hideKey && hideable.debugMode && <HideToggleButton hidden={hideable.hidden} onToggle={hideable.toggle} />}
      <div className="flex flex-1 rounded-lg border border-neutral-700 bg-neutral-900 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-sm transition-colors',
              value === opt.value ? 'bg-purple-500 text-white' : 'text-neutral-400 hover:text-neutral-200',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
