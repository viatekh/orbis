import { cn } from '../../lib/utils'
import { HideToggleButton } from './HideToggleButton'
import { useHideable } from './useHideable'
import type { ReactNode } from 'react'

interface CheckboxProps {
  label: ReactNode
  /** The label text used to compute this control's hide-id — pass the
   * plain-text version when `label` is richer JSX (e.g. includes a trailing
   * note span), so the id stays stable and readable. */
  hideLabel?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

/** Shared checkbox-with-label, consolidating what used to be ~10 near-
 * identical inline `<label><input type="checkbox">` blocks — and, since
 * it's the one chokepoint every checkbox now goes through, where the
 * debug-mode hide toggle lives for all of them. */
export function Checkbox({ label, hideLabel, checked, onChange, disabled, className }: CheckboxProps) {
  const { debugMode, hidden, toggle } = useHideable(hideLabel ?? (typeof label === 'string' ? label : ''))
  if (hidden && !debugMode) return null

  return (
    <label className={cn('flex items-center gap-2 text-sm', hidden && 'opacity-40', className)}>
      {debugMode && <HideToggleButton hidden={hidden} onToggle={toggle} />}
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
