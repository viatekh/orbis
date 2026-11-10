import { cn } from '../../lib/utils'
import { HideToggleButton } from './HideToggleButton'
import { useHideable } from './useHideable'

interface Option<T extends string> {
  value: T
  label: string
}

interface SelectProps<T extends string> {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  /** Opts this control into the debug-mode hide system, under this key —
   * omit for controls that should always stay visible (e.g. the shape-kind
   * picker), since without a key there's nothing to hide by. */
  hideKey?: string
}

export function Select<T extends string>({ value, options, onChange, hideKey }: SelectProps<T>) {
  const hideable = useHideable(hideKey ?? '')
  if (hideKey && hideable.hidden && !hideable.debugMode) return null

  return (
    <div className={cn('flex items-center gap-1.5', hideKey && hideable.hidden && 'opacity-40')}>
      {hideKey && hideable.debugMode && <HideToggleButton hidden={hideable.hidden} onToggle={hideable.toggle} />}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm text-neutral-200 outline-none focus:border-purple-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
