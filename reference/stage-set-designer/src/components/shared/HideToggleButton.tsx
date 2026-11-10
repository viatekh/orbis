import { Eye, EyeOff } from 'lucide-react'

/** The small eye/eye-off icon a hideable control shows next to itself,
 * only while debug mode is on. Stops propagation so it never triggers
 * whatever the control it's sitting inside (e.g. a <label>) would do on
 * click. */
export function HideToggleButton({ hidden, onToggle }: { hidden: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onToggle()
      }}
      className="shrink-0 text-neutral-600 hover:text-neutral-300"
      title={hidden ? 'Show this control' : 'Hide this control'}
    >
      {hidden ? <EyeOff size={11} /> : <Eye size={11} />}
    </button>
  )
}
