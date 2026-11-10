import { useContext } from 'react'
import { HideScopeContext } from './hideScopeContext'
import { useUiSettingsStore } from '../../store/uiSettingsStore'

export function useHideId(label: string): string {
  const scope = useContext(HideScopeContext)
  return scope ? `${scope}.${label}` : label
}

/** Everything a hideable control needs: whether it's currently hidden and
 * whether debug mode is on (so the caller can decide whether to render at
 * all), plus a `toggle` to flip the hidden state. */
export function useHideable(label: string): { debugMode: boolean; hidden: boolean; toggle: () => void } {
  const id = useHideId(label)
  const debugMode = useUiSettingsStore((s) => s.debugMode)
  const hidden = useUiSettingsStore((s) => s.hiddenControls.includes(id))
  const setControlHidden = useUiSettingsStore((s) => s.setControlHidden)
  return { debugMode, hidden, toggle: () => setControlHidden(id, !hidden) }
}
