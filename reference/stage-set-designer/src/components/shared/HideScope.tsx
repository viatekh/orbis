import { useContext } from 'react'
import type { ReactNode } from 'react'
import { HideScopeContext } from './hideScopeContext'

/** Nests a namespace segment onto whatever scope path is already active —
 * e.g. `<HideScope name="pattern">` around PatternPanel, with
 * `<HideScope name="radialEffects">` around the RadialEffectsPanel it
 * renders inside itself, composes to "pattern.radialEffects" for anything
 * inside. This is what keeps same-labeled fields in different panels (or
 * different shape kinds within ShapeFields) from colliding on one hide id. */
export function HideScope({ name, children }: { name: string; children: ReactNode }) {
  const parent = useContext(HideScopeContext)
  const scope = parent ? `${parent}.${name}` : name
  return <HideScopeContext.Provider value={scope}>{children}</HideScopeContext.Provider>
}
